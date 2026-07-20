# TASK-06 — DevOps & Deployment (Owner: DevOps AI) — branch `feat/devops`

Docker, CI, and deployment paths for Railway / Render / DigitalOcean / VPS.

## Read first
`docs/01-ARCHITECTURE.md` §4 (processes: api, worker, dashboard) · `tasks/TASK-00-COORDINATION.md`

## Deliverables
1. **Dockerfiles** (multi-stage, node:22-alpine, non-root user, `npm ci` layer-cached, prisma generate at build):
   - `apps/backend/Dockerfile` — one image, two commands (`node dist/server.js` / `node dist/worker.js`)
   - `apps/dashboard/Dockerfile` — build → nginx static serve with SPA fallback + gzip
2. **docker-compose.yml** (dev): postgres:16, redis:7, minio, api (with `prisma migrate deploy` entrypoint), worker, dashboard; healthchecks on all; volumes for pg/minio; `docker-compose.prod.yml` overlay
3. **.env.example** hygiene: verify every env var consumed in code exists there with a comment (script: `npm run check:env`)
4. **CI (GitHub Actions)**: lint + typecheck + unit tests on PR; integration tests with postgres/redis service containers; docker build; prisma migration check (`migrate diff` against main)
5. **Deployment guides** in `docs/deploy/`:
   - `railway.md` (two services from one repo + managed PG/Redis)
   - `render.md`, `digitalocean.md` (App Platform + Spaces), `vps.md` (compose + Caddy for TLS + webhook HTTPS requirement)
   - Each covers: LINE webhook URL setup, migration step, zero-downtime notes
6. **Ops**: pino → stdout JSON (12-factor); `/healthz` (liveness) + `/readyz` (DB+Redis ping) — endpoints exist in core; backup note for Postgres (pg_dump cron / managed snapshots)

## Acceptance criteria
- `docker compose up` from a clean clone → bot answers webhook + dashboard on :5173 with only `.env` filled in
- Images < 300 MB (backend), < 50 MB (dashboard)
- CI green on a no-op PR; red on a type error (prove both once)

## Schema/contract change requests
_(append here)_
