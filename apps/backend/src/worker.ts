import { Worker } from "bullmq";
import { createRedis, QUEUE_NAMES, type LineEventJob } from "./jobs/queues.js";
import { createContainer } from "./container.js";
import { logger } from "./utils/logger.js";

/**
 * Background worker: consumes line-events and runs the full pipeline
 * (user resolve → parse (rules → Claude) → dispatch → LINE reply).
 * Later queues: ocr (TASK-03), notifications, exports (TASK-05).
 */
const { pipeline, prisma } = createContainer();

const worker = new Worker<LineEventJob>(
  QUEUE_NAMES.lineEvents,
  async (job) => {
    await pipeline.process(job.data.event);
  },
  { connection: createRedis(), concurrency: 10 },
);

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "line event processing failed");
});

logger.info("🤵 Finance Butler worker started");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void worker
      .close()
      .then(() => prisma.$disconnect())
      .then(() => process.exit(0));
  });
}
