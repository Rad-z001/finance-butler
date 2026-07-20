import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { createWebhookRouter, type WebhookDeps } from "./routes/webhook.route.js";
import { errorHandler } from "./middlewares/error-handler.js";

/**
 * App factory (no listen) so tests can drive it with supertest.
 * NOTE: the webhook mounts BEFORE express.json() — it needs the raw body.
 */
export function createApp(deps: WebhookDeps): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // raw-body route first
  app.use("/webhook", createWebhookRouter(deps));

  // REST API for the dashboard
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  // app.use("/api/v1", apiRouter);  // M4+: mounted as API modules land

  app.use(errorHandler);
  return app;
}
