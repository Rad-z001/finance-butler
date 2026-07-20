import { Router, raw } from "express";
import type { WebhookEvent, WebhookRequestBody } from "@line/bot-sdk";
import { env } from "../config/env.js";
import { verifyLineSignature } from "../line/signature.js";
import { logger } from "../utils/logger.js";

export interface WebhookDeps {
  /** Queue mode: enqueue to BullMQ. Inline mode (no Redis): run the pipeline directly. */
  dispatch(events: WebhookEvent[]): Promise<void>;
}

/**
 * LINE webhook. Contract (docs/03-WORKFLOWS.md §1):
 *   1. verify signature on the RAW body (before JSON parse)
 *   2. ACK 200 immediately — LINE requires a fast response
 *   3. hand events to the injected dispatcher (fire-and-forget)
 * Duplicate-delivery protection lives behind `dispatch` (Redis fast path in
 * queue mode) and, always, the WebhookEvent unique column in the pipeline.
 */
export function createWebhookRouter(deps: WebhookDeps): Router {
  const router = Router();

  router.post("/", raw({ type: "*/*", limit: "1mb" }), (req, res) => {
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

    res.status(200).end();

    void deps.dispatch(body.events ?? []).catch((err) => {
      logger.error({ err }, "webhook: dispatch failed");
    });
  });

  return router;
}
