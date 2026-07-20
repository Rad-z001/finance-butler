# TASK-00 — Coordination Rules (read first, every AI)

You are one of several AI engineers building **Finance Butler AI**. Before writing any code, read:
`docs/00-MASTER-PLAN.md` → `docs/01-ARCHITECTURE.md` → `docs/02-DATABASE.md` → `docs/03-WORKFLOWS.md` → your own task file.

## Ground rules

1. **Contracts are frozen for you.** `apps/backend/prisma/schema.prisma`, `packages/shared/`, and `docs/04-API-CONTRACTS.md` are owned by TASK-01 (core). If you need a change, add a bullet under the "Schema/contract change requests" section of **your** task file and stop at the boundary — do not edit the contract yourself.
2. **Branching.** Work only on your assigned branch (`feat/dashboard`, `feat/ocr`, …) cut from `main`. Rebase on `main` before opening a PR. Never push to `main`.
3. **Interfaces over imports.** If your module is consumed by core (OCR, LINE UI, reports), implement the TypeScript interface named in your task file from `apps/backend/src/entities/ports/`. Core wires it in `container.ts` — you never touch the container.
4. **Code style.** Strict TypeScript (`"strict": true`, no `any` unless justified with a comment), ESLint + Prettier configs at repo root, small pure functions, no duplicated code. Money is `Decimal`/string — never `number` arithmetic on amounts.
5. **Tests ship with code.** Minimum: unit tests for logic, one integration test per external boundary. Test files mirror source paths under `src/tests/`.
6. **Thai copy.** All user-facing bot text is Thai (casual-polite, ครับ/ค่ะ neutral — use "ครับ/ค่ะ"-free phrasing or 😊). Dashboard is bilingual TH/EN (i18n keys, Thai default).
7. **Secrets.** Only via env vars. Update `.env.example` when you add one, with a comment.
8. **Definition of done** = acceptance criteria in your task file all pass + `npm run lint && npm run typecheck && npm test` green + PR description explains every file.

## Status board (update your row in your PR)

| Task | Owner | Branch | Status |
|---|---|---|---|
| 01 Core backend | Claude (core session) | main / feat/core-* | 🟡 in progress |
| 02 Dashboard UI | unassigned | feat/dashboard | ⚪ ready to start (mock API) |
| 03 OCR pipeline | unassigned | feat/ocr | ⚪ ready after M1 (interfaces published) |
| 04 LINE rich UI | unassigned | feat/line-ui | ⚪ ready after M1 |
| 05 Reports/exports | unassigned | feat/reports | ⚪ ready after M2 |
| 06 DevOps | unassigned | feat/devops | ⚪ ready to start |
| 07 QA/testing | unassigned | feat/qa | ⚪ continuous |
