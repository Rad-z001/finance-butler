import { Router, raw } from "express";
import type { WebhookRequestBody } from "@line/bot-sdk";
import { env } from "../config/env.js";
import { verifyLineSignature } from "../line/signature.js";
import { claimEventOnce, dedupeRedis, lineEventsQueue } from "../jobs/queues.js";
import { logger } from "../utils/logger.js";

/**
 * LINE webhook. Contract (docs/03-WORKFLOWS.md §1):
 *   1. verify signature on the RAW body (before JSON parse)
 *   2. dedupe by webhookEventId (Redis fast path)
 *   3. enqueue for the worker
 *   4. ACK 200 immediately — LINE requires a fast response
 */
export const webhookRouter = Router();

webhookRouter.post("/", raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const rawBody = req.body as Buffer;
  const signature = req.header("x-line-signature");

  if (!verifyLineSignature(env.LINE_CHANNEL_SECRET, rawBody, signature)) {
    logger.warn("webhook: invalid signature");
    res.status(401).end();
    return;
  }

  let body: WebhookRequestBody;
  try {
    body = JSON.parse(rawBody.toString("utf-8")) as WebhookRequestBody;
  } catch {
    res.status(400).end();
    return;
  }

  // ACK before processing — enqueueing is fast but must never block the 200
  res.status(200).end();

  const receivedAt = new Date().toISOString();
  for (const event of body.events ?? []) {
    const eventId = "webhookEventId" in event ? event.webhookEventId : undefined;
    try {
      if (eventId && !(await claimEventOnce(dedupeRedis, eventId))) {
        logger.debug({ eventId }, "webhook: duplicate event skipped");
        continue;
      }
      await lineEventsQueue.add("event", { event, receivedAt });
    } catch (err) {
      logger.error({ err, eventId }, "webhook: enqueue failed");
    }
  }
});
