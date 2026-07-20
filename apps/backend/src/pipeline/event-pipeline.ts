import type { WebhookEvent } from "@line/bot-sdk";
import type { PrismaClient, User } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import type { ILineMessenger } from "../line/client.js";
import type { IMessageBuilder } from "../entities/ports/message-builder.js";
import type { UserService } from "../services/user.service.js";
import type { ThaiRuleParser } from "../nlp/thai-rule-parser.js";
import type { ClaudeClient } from "../ai/claude.js";
import type { IntentDispatcher } from "./intent-dispatcher.js";
import { logger } from "../utils/logger.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Worker-side entry for every LINE event (docs/03-WORKFLOWS.md §1).
 * Parse order: rules → Claude fallback. WebhookEvent row = hard dedupe.
 */
export class EventPipeline {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly users: UserService,
    private readonly parser: ThaiRuleParser,
    private readonly ai: ClaudeClient,
    private readonly dispatcher: IntentDispatcher,
    private readonly line: ILineMessenger,
    private readonly msg: IMessageBuilder,
  ) {}

  async process(event: WebhookEvent): Promise<void> {
    if (!(await this.claimEvent(event))) return;

    const lineUserId = event.source.type === "user" ? event.source.userId : undefined;
    if (!lineUserId) return; // group/room support is out of scope for M1

    switch (event.type) {
      case "follow": {
        const user = await this.users.findOrCreateByLineId(lineUserId);
        await this.users.setActive(lineUserId, true);
        await this.line.push(lineUserId, this.msg.welcome(user.displayName));
        return;
      }
      case "unfollow":
        await this.users.setActive(lineUserId, false);
        return;
      case "message": {
        const user = await this.users.findOrCreateByLineId(lineUserId);
        if (event.message.type === "text") {
          await this.handleText(user, event.message.text, event.replyToken);
        } else if (event.message.type === "image") {
          // M3 (TASK-03) plugs the OCR pipeline in here
          await this.line.reply(event.replyToken, [
            { type: "text", text: "อ่านสลิป/ใบเสร็จอัตโนมัติกำลังมาเร็วๆ นี้ 📸🚧" },
          ]);
        }
        return;
      }
      case "postback": {
        const user = await this.users.findOrCreateByLineId(lineUserId);
        const messages = await this.dispatcher.dispatchPostback(user, event.postback.data);
        await this.line.reply(event.replyToken, messages);
        return;
      }
      default:
        logger.debug({ type: event.type }, "unhandled event type");
    }
  }

  private async handleText(user: User, text: string, replyToken: string): Promise<void> {
    const started = Date.now();
    let intent = this.parser.parse(text, user.timezone);

    if (intent.kind === "unknown") {
      const today = dayjs().tz(user.timezone).format("YYYY-MM-DD");
      intent = await this.ai.parseIntent(text, today);
    }

    const messages = await this.dispatcher.dispatch(user, intent);
    await this.line.reply(replyToken, messages);

    // conversation memory + parse-quality metrics
    await this.prisma.aIConversation
      .create({
        data: { userId: user.id, role: "USER", content: text.slice(0, 2000), intent: intent.kind },
      })
      .catch((err) => logger.warn({ err }, "aiConversation log failed"));
    logger.info(
      { intent: intent.kind, ms: Date.now() - started, ai: intent.kind !== "unknown" && "parsedBy" in intent ? intent.parsedBy : undefined },
      "text handled",
    );
  }

  /** DB-level dedupe: unique eventId. Returns false when already processed. */
  private async claimEvent(event: WebhookEvent): Promise<boolean> {
    const eventId = "webhookEventId" in event ? (event.webhookEventId as string) : undefined;
    if (!eventId) return true;
    try {
      await this.prisma.webhookEvent.create({ data: { eventId, processedAt: new Date() } });
      return true;
    } catch {
      logger.debug({ eventId }, "duplicate event (db)");
      return false;
    }
  }
}
