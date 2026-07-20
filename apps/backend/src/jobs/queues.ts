import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { WebhookEvent } from "@line/bot-sdk";
import { env } from "../config/env.js";

/** Shared Redis connection factory (BullMQ requires maxRetriesPerRequest: null). */
export function createRedis(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export const QUEUE_NAMES = {
  lineEvents: "line-events",
  ocr: "ocr",
  notifications: "notifications",
  exports: "exports",
} as const;

export interface LineEventJob {
  event: WebhookEvent;
  receivedAt: string;
}

const connection = createRedis();

export const lineEventsQueue = new Queue<LineEventJob>(QUEUE_NAMES.lineEvents, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

/**
 * Fast-path webhook dedupe. LINE retries deliveries; `webhookEventId` is stable
 * across retries. Returns true when this is the first time we see the event.
 * (The hard guarantee is the WebhookEvent unique column, enforced by the worker.)
 */
export async function claimEventOnce(redis: Redis, eventId: string): Promise<boolean> {
  const result = await redis.set(`line:evt:${eventId}`, "1", "EX", 3600, "NX");
  return result === "OK";
}

export const dedupeRedis = createRedis();
