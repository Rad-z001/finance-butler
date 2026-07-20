import { describe, expect, it, vi } from "vitest";
import type { MessageEvent, WebhookEvent } from "@line/bot-sdk";
import type { PrismaClient, User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { EventPipeline } from "../../pipeline/event-pipeline.js";
import { IntentDispatcher } from "../../pipeline/intent-dispatcher.js";
import { CoreMessageBuilder } from "../../line/messages/core-builder.js";
import { ThaiRuleParser } from "../../nlp/thai-rule-parser.js";
import type { UserService } from "../../services/user.service.js";
import { TransactionService, type TxnWithRelations } from "../../services/transaction.service.js";
import type { CategoryService } from "../../services/category.service.js";
import type { StatsService } from "../../services/stats.service.js";
import type { IAiClient } from "../../ai/claude.js";
import type { ILineMessenger, LineMessage } from "../../line/client.js";

/**
 * End-to-end smoke of the glue (webhook event → parse → dispatch → reply)
 * with in-memory fakes at the service boundary. DB-backed integration tests
 * are TASK-07 (testcontainers).
 */

const user: User = {
  id: "u1", lineUserId: "U123", displayName: "Test", pictureUrl: null, isGroup: false,
  timezone: "Asia/Bangkok", language: "th", nextTxnRef: 2, isActive: true,
  createdAt: new Date(), updatedAt: new Date(),
};

const groupLedger: User = { ...user, id: "g1", lineUserId: "C999", displayName: "คู่เรา", isGroup: true };

const fakeTxn = {
  id: "t1", shortRef: 1, type: "EXPENSE", amount: new Prisma.Decimal("80"),
  currency: "THB", description: "กินข้าว", merchant: null,
  occurredAt: new Date(), deletedAt: null,
  category: { nameTh: "อาหาร", icon: "🍚" },
  account: { name: "เงินสด" },
} as unknown as TxnWithRelations;

function buildPipeline() {
  const created: unknown[] = [];
  const replies: LineMessage[][] = [];

  const prisma = {
    webhookEvent: { create: vi.fn(async () => ({})) },
    aIConversation: { create: vi.fn(async () => ({})) },
  } as unknown as PrismaClient;

  const users = {
    findOrCreateByLineId: vi.fn(async () => user),
    findOrCreateGroupLedger: vi.fn(async () => groupLedger),
    defaultAccount: vi.fn(async () => ({ id: "a1", name: "เงินสด" })),
    setActive: vi.fn(async () => undefined),
    findAccountByHint: vi.fn(async () => null),
  } as unknown as UserService;

  const realTxnService = { toView: TransactionService.prototype.toView } as TransactionService;
  const txns = {
    create: vi.fn(async (input: unknown) => {
      created.push(input);
      return { txn: fakeTxn, balance: new Prisma.Decimal("4920") };
    }),
    toView: realTxnService.toView.bind(realTxnService),
  } as unknown as TransactionService;

  const categories = {
    resolveForTransaction: vi.fn(async () => ({ id: "c1", nameTh: "อาหาร", icon: "🍚" })),
  } as unknown as CategoryService;

  const stats = {} as StatsService;
  const ai = {
    parseIntent: vi.fn(async (text: string) => ({ kind: "unknown", text })),
  } as unknown as IAiClient;

  const line: ILineMessenger = {
    reply: vi.fn(async (_t, messages) => void replies.push(messages)),
    push: vi.fn(async () => undefined),
    getProfile: vi.fn(async () => ({ displayName: "Test" })),
    getGroupName: vi.fn(async () => "คู่เรา"),
    getMemberName: vi.fn(async () => "แฟน"),
  };

  const msg = new CoreMessageBuilder();
  const dispatcher = new IntentDispatcher(users, txns, categories, stats, ai, msg);
  const pipeline = new EventPipeline(prisma, users, new ThaiRuleParser(), ai, dispatcher, line, msg);
  return { pipeline, created, replies, ai };
}

function textEvent(text: string): WebhookEvent {
  return {
    type: "message",
    message: { type: "text", id: "m1", text, quoteToken: "q" },
    webhookEventId: `evt-${Math.random()}`,
    deliveryContext: { isRedelivery: false },
    timestamp: Date.now(),
    source: { type: "user", userId: "U123" },
    replyToken: "rt1",
    mode: "active",
  } as MessageEvent;
}

describe("pipeline smoke: กินข้าว 80", () => {
  it("saves a transaction and replies with a Flex confirmation — no AI call", async () => {
    const { pipeline, created, replies, ai } = buildPipeline();
    await pipeline.process(textEvent("กินข้าว 80"));

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ amount: "80", type: "EXPENSE", source: "NLP" });
    expect(ai.parseIntent).not.toHaveBeenCalled();

    expect(replies).toHaveLength(1);
    const flex = replies[0]?.[0];
    expect(flex?.type).toBe("flex");
    expect(JSON.stringify(flex)).toContain("บันทึกแล้ว");
  });

  it("routes unknown text to the Claude fallback", async () => {
    const { pipeline, ai, replies } = buildPipeline();
    await pipeline.process(textEvent("ควรจัดการเงินยังไงดี"));
    expect(ai.parseIntent).toHaveBeenCalledOnce();
    expect(replies[0]?.[0]?.type).toBe("text"); // cannot_parse fallback from fake ai
  });
});

describe("group-ledger mode", () => {
  function groupTextEvent(text: string): WebhookEvent {
    const e = textEvent(text) as MessageEvent;
    return {
      ...e,
      source: { type: "group", groupId: "C999", userId: "U123" },
    } as WebhookEvent;
  }

  it("records into the shared ledger with the payer's name", async () => {
    const { pipeline, created, replies } = buildPipeline();
    await pipeline.process(groupTextEvent("ค่าข้าวเย็น 450"));
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ amount: "450", actorName: "แฟน", actorLineUserId: "U123" });
    expect(replies).toHaveLength(1);
  });

  it("stays SILENT on normal group chatter (no AI, no error spam)", async () => {
    const { pipeline, ai, replies, created } = buildPipeline();
    await pipeline.process(groupTextEvent("คืนนี้กินอะไรดี"));
    expect(created).toHaveLength(0);
    expect(ai.parseIntent).not.toHaveBeenCalled();
    expect(replies).toHaveLength(0);
  });
});
