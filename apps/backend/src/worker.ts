import { Worker } from "bullmq";
import { createRedis, QUEUE_NAMES, type LineEventJob } from "./jobs/queues.js";
import { logger } from "./utils/logger.js";

/**
 * Background worker process: consumes line-events (and later: ocr, notifications,
 * exports; plus repeatable jobs for recurring transactions and reminders).
 *
 * M1 (next milestone) replaces the stub below with the full pipeline:
 *   resolve user → MessageParser (corrections → rules → Claude) → IntentDispatcher → reply.
 */
const worker = new Worker<LineEventJob>(
  QUEUE_NAMES.lineEvents,
  async (job) => {
    const { event } = job.data;
    logger.info({ type: event.type }, "line event received (pipeline lands in M1)");
    // TODO(M1): EventPipeline.process(event) — see docs/03-WORKFLOWS.md §1
  },
  { connection: createRedis(), concurrency: 10 },
);

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "line event processing failed");
});

logger.info("🤵 Finance Butler worker started");
