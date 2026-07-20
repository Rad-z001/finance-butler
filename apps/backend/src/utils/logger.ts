import { pino } from "pino";

const isDev = process.env["NODE_ENV"] !== "production";

/** Structured JSON logs in prod (12-factor: stdout), pretty in dev. */
export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? (isDev ? "debug" : "info"),
  redact: {
    paths: ["req.headers.authorization", "*.lineUserId", "*.accessToken"],
    censor: "[redacted]",
  },
  ...(isDev
    ? { transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss" } } }
    : {}),
});

export type Logger = typeof logger;
