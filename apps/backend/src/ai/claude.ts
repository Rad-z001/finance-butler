import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ParsedIntent } from "@finance-butler/shared";
import { TRANSACTION_TYPES, SYSTEM_CATEGORIES } from "@finance-butler/shared";
import { logger } from "../utils/logger.js";

/**
 * Layer 3 of the parse pipeline: only messages the rule parser marked "unknown"
 * reach Claude (docs/00-MASTER-PLAN.md D2). Tool-use with a forced tool call
 * guarantees structured output; zod re-validates before anything touches money.
 */

const zAiIntent = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("add_transaction"),
    type: z.enum(TRANSACTION_TYPES),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    description: z.string().min(1).max(200),
    merchant: z.string().optional(),
    categoryKey: z.string().optional(),
    occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    kind: z.literal("search"),
    text: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  z.object({
    kind: z.literal("stats"),
    period: z.enum(["day", "week", "month", "quarter", "year"]),
  }),
  z.object({ kind: z.literal("question"), text: z.string() }),
  z.object({ kind: z.literal("unknown") }),
]);

const INTENT_TOOL: Anthropic.Tool = {
  name: "submit_intent",
  description: "Submit the parsed intent of the user's Thai finance message.",
  input_schema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["add_transaction", "search", "stats", "question", "unknown"],
      },
      type: { type: "string", enum: [...TRANSACTION_TYPES] },
      amount: { type: "string", description: "decimal string, e.g. '1200.50'" },
      description: { type: "string" },
      merchant: { type: "string" },
      categoryKey: {
        type: "string",
        enum: SYSTEM_CATEGORIES.map((c) => c.key),
      },
      occurredAt: { type: "string", description: "YYYY-MM-DD in the user's timezone" },
      text: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      period: { type: "string", enum: ["day", "week", "month", "quarter", "year"] },
    },
    required: ["kind"],
  },
};

export interface IAiClient {
  parseIntent(text: string, todayLocal: string): Promise<ParsedIntent>;
  answerQuestion(question: string, statsContext: string): Promise<string>;
}

/** Wired when no ANTHROPIC_API_KEY is set — the bot runs rules-only. */
export class DisabledAiClient implements IAiClient {
  async parseIntent(text: string): Promise<ParsedIntent> {
    return { kind: "unknown", text };
  }
  async answerQuestion(): Promise<string> {
    return "โหมดตอบคำถามยังไม่เปิดใช้งาน 🙏 (เปิดได้โดยใส่ ANTHROPIC_API_KEY ใน .env)";
  }
}

export class ClaudeClient implements IAiClient {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly parseModel: string,
    private readonly answerModel: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async parseIntent(text: string, todayLocal: string): Promise<ParsedIntent> {
    try {
      const res = await this.client.messages.create({
        model: this.parseModel,
        max_tokens: 500,
        system:
          `You parse Thai personal-finance chat messages into intents. Today is ${todayLocal}. ` +
          `Amounts are Thai Baht unless stated. "เมื่อวาน"=yesterday, "เมื่อเช้า"=today. ` +
          `If the message records money in/out, use add_transaction. If it asks about ` +
          `spending history, use search or stats. General finance questions → question. ` +
          `If it is not about finance at all → unknown. Never invent an amount.`,
        messages: [{ role: "user", content: text }],
        tools: [INTENT_TOOL],
        tool_choice: { type: "tool", name: "submit_intent" },
      });

      const toolUse = res.content.find((b) => b.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") return { kind: "unknown", text };
      const parsed = zAiIntent.safeParse(toolUse.input);
      if (!parsed.success) {
        logger.warn({ issues: parsed.error.issues }, "ai intent failed validation");
        return { kind: "unknown", text };
      }

      const d = parsed.data;
      switch (d.kind) {
        case "add_transaction":
          return {
            kind: "add_transaction",
            type: d.type,
            amount: d.amount,
            description: d.description,
            ...(d.merchant ? { merchant: d.merchant } : {}),
            ...(d.categoryKey ? { categoryHint: d.categoryKey } : {}),
            occurredAt: d.occurredAt,
            parsedBy: "ai",
            confidence: 0.8,
          };
        case "search":
          return {
            kind: "search",
            query: {
              ...(d.text ? { text: d.text } : {}),
              ...(d.from ? { from: d.from } : {}),
              ...(d.to ? { to: d.to } : {}),
            },
          };
        case "stats":
          return { kind: "stats", period: d.period === "quarter" ? "month" : d.period };
        case "question":
          return { kind: "question", text: d.text };
        default:
          return { kind: "unknown", text };
      }
    } catch (err) {
      logger.error({ err }, "claude parse failed — degrading to unknown");
      return { kind: "unknown", text };
    }
  }

  /** Short Thai answers to finance questions, grounded in the user's own summary. */
  async answerQuestion(question: string, statsContext: string): Promise<string> {
    try {
      const res = await this.client.messages.create({
        model: this.answerModel,
        max_tokens: 400,
        system:
          "You are Finance Butler, a friendly Thai personal-finance assistant in LINE. " +
          "Answer briefly in casual-polite Thai (2-5 sentences, may use emoji). " +
          "Use the provided spending summary when relevant. " +
          "Never give personalized investment advice or recommend specific securities; " +
          "for investment questions, give general educational info and suggest consulting " +
          "a licensed advisor.",
        messages: [
          {
            role: "user",
            content: `สรุปการเงินของผู้ใช้:\n${statsContext}\n\nคำถาม: ${question}`,
          },
        ],
      });
      const textBlock = res.content.find((b) => b.type === "text");
      return textBlock && textBlock.type === "text"
        ? textBlock.text
        : "ขอโทษด้วย ตอบไม่ได้ตอนนี้ 🙏";
    } catch (err) {
      logger.error({ err }, "claude answer failed");
      return "ขอโทษด้วย ระบบตอบคำถามขัดข้องชั่วคราว 🙏";
    }
  }
}
