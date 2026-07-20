import { env } from "./config/env.js";
import { createPrisma, type PrismaClient } from "./repositories/prisma.js";
import { LineMessenger, type ILineMessenger } from "./line/client.js";
import { CoreMessageBuilder } from "./line/messages/core-builder.js";
import { ThaiRuleParser } from "./nlp/thai-rule-parser.js";
import { ClaudeClient } from "./ai/claude.js";
import { UserService } from "./services/user.service.js";
import { CategoryService } from "./services/category.service.js";
import { TransactionService } from "./services/transaction.service.js";
import { StatsService } from "./services/stats.service.js";
import { IntentDispatcher } from "./pipeline/intent-dispatcher.js";
import { EventPipeline } from "./pipeline/event-pipeline.js";

/**
 * Composition root (docs/00-MASTER-PLAN.md D6): all concrete wiring lives here.
 * Tests build services directly with fakes; nothing else news up dependencies.
 */
export interface Container {
  prisma: PrismaClient;
  line: ILineMessenger;
  pipeline: EventPipeline;
}

export function createContainer(): Container {
  const prisma = createPrisma();
  const line = new LineMessenger(env.LINE_CHANNEL_ACCESS_TOKEN);
  const msg = new CoreMessageBuilder();
  const parser = new ThaiRuleParser();
  const ai = new ClaudeClient(env.ANTHROPIC_API_KEY, env.AI_PARSE_MODEL, env.AI_CLASSIFY_MODEL);

  const users = new UserService(prisma, line);
  const categories = new CategoryService(prisma);
  const txns = new TransactionService(prisma);
  const stats = new StatsService(prisma);

  const dispatcher = new IntentDispatcher(users, txns, categories, stats, ai, msg);
  const pipeline = new EventPipeline(prisma, users, parser, ai, dispatcher, line, msg);

  return { prisma, line, pipeline };
}
