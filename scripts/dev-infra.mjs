#!/usr/bin/env node
/**
 * No-Docker dev infrastructure: embedded PostgreSQL + project-local Redis.
 * Usage: npm run dev:infra   (keep it running; Ctrl-C stops both cleanly)
 *
 * Postgres: official binaries via the `embedded-postgres` package,
 *           data persisted in .devtools/pgdata, listening on :5432.
 * Redis:    .devtools/bin/redis-server (compiled from redis.io source), :6379.
 * If you later install Docker, `docker compose -f docker-compose.dev.yml up`
 * is a drop-in replacement (same ports/credentials).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pgDataDir = join(root, ".devtools", "pgdata");
const redisBin = join(root, ".devtools", "bin", "redis-server");

const pg = new EmbeddedPostgres({
  databaseDir: pgDataDir,
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
});

const firstRun = !existsSync(join(pgDataDir, "PG_VERSION"));
if (firstRun) {
  console.log("[dev-infra] initialising postgres data dir…");
  await pg.initialise();
}
await pg.start();
if (firstRun) {
  await pg.createDatabase("finance_butler");
}
console.log("[dev-infra] ✅ postgres ready on :5432 (db: finance_butler)");

const redis = spawn(redisBin, ["--port", "6379", "--save", "", "--appendonly", "no"], {
  stdio: "inherit",
});
console.log("[dev-infra] ✅ redis starting on :6379");

async function shutdown() {
  console.log("\n[dev-infra] stopping…");
  redis.kill("SIGTERM");
  await pg.stop().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
