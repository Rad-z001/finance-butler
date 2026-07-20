import { z } from "zod";

/**
 * Zod-validated environment. Import `env` anywhere — the process refuses to boot
 * with a clear message if configuration is missing or malformed.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(3000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) => s.split(",").map((o) => o.trim())),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_LOGIN_CHANNEL_ID: z.string().optional(),
  LINE_LOGIN_CHANNEL_SECRET: z.string().optional(),
  LINE_LOGIN_CALLBACK_URL: z.string().url().optional(),

  ANTHROPIC_API_KEY: z.string().min(1),
  AI_PARSE_MODEL: z.string().default("claude-sonnet-5"),
  AI_CLASSIFY_MODEL: z.string().default("claude-haiku-4-5-20251001"),

  OCR_PROVIDER: z.enum(["google", "tesseract"]).default("tesseract"),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("finance-butler"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`❌ Invalid environment:\n${issues}\n(see apps/backend/.env.example)`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
