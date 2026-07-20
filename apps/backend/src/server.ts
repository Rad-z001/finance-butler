import type { WebhookEvent } from "@line/bot-sdk";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createContainer } from "./container.js";
import { seedSystemCategories } from "./services/bootstrap.js";
import { logger } from "./utils/logger.js";

const container = createContainer();
await seedSystemCategories(container.prisma);

/**
 * Two run modes (docs/00-MASTER-PLAN.md D4 + free-hosting addendum):
 * - REDIS_URL set   → queue mode: webhook enqueues, a separate worker process
 *                     consumes (scalable path — VPS/Docker/Railway)
 * - REDIS_URL unset → inline mode: this one process does everything
 *                     (free single-process hosts like Render; no Redis at all)
 */
let dispatch: (events: WebhookEvent[]) => Promise<void>;

if (env.REDIS_URL) {
  const { lineEventsQueue, claimEventOnce, dedupeRedis } = await import("./jobs/queues.js");
  const receivedAt = () => new Date().toISOString();
  dispatch = async (events) => {
    for (const event of events) {
      const eventId = "webhookEventId" in event ? (event.webhookEventId as string) : undefined;
      if (eventId && !(await claimEventOnce(dedupeRedis, eventId))) continue;
      await lineEventsQueue.add("event", { event, receivedAt: receivedAt() });
    }
  };
  logger.info("run mode: queue (Redis) — start the worker process too");
} else {
  dispatch = async (events) => {
    for (const event of events) {
      await container.pipeline.process(event);
    }
  };
  logger.info("run mode: inline (no REDIS_URL) — single process handles everything");
}

const app = createApp({ dispatch });

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "🤵 Finance Butler API listening");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
