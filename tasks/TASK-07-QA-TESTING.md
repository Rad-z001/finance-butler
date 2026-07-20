# TASK-07 — QA & Testing (Owner: QA AI) — branch `feat/qa`, continuous

Own the test strategy, the Thai-language test corpus, and end-to-end coverage. Unit tests ship with each task's code (their owners write them) — you own everything above that.

## Read first
All of `docs/` · every task file's acceptance criteria (they are your test spec) · `tasks/TASK-00-COORDINATION.md`

## Deliverables
1. **Test infrastructure**: vitest workspace config; `testcontainers` (or compose) postgres+redis for integration; DB truncation between tests; factory helpers (`makeUser`, `makeTxn`) in `src/tests/factories/`
2. **Thai message corpus** — `src/tests/fixtures/thai-messages.json`: ≥150 real-world phrasings with expected `ParsedIntent`, covering: plain expenses, incomes, all date words (วันนี้/เมื่อวาน/พรุ่งนี้/วันจันทร์/15 ก.ค./1/7/เดือนก่อน/เดือนที่แล้ว), amounts (`80`, `1,200`, `1.2k`, `80 บาท`), edits, deletes (`ลบ #52`), searches (`กาแฟเดือนนี้`), stats commands, transfers, investments (`ซื้อหุ้น NVDA 5000`), budget/goal phrases, junk/ambiguous input. This corpus gates TASK-01's parser (≥80% rule coverage, 100% with LLM fallback mocked)
3. **Integration suites**: webhook signature (valid/invalid/replayed), dedupe (same eventId twice → one txn), transfer rollback, budget alert firing at exactly 50/80/100, recurring idempotency, soft-delete/restore, API contract conformance (run every endpoint against zod schemas from `packages/shared`)
4. **E2E**: scripted fake-LINE client (POST signed webhook payloads) driving full scenarios: register → add expenses → search → edit → delete → summary → export. Dashboard E2E with Playwright (login mocked, Overview + Transactions happy paths)
5. **Load sanity**: k6 or autocannon — 100 concurrent webhook events, p95 ACK < 200 ms, zero dropped events
6. **Coverage gates in CI**: services ≥85% lines, nlp ≥90%, repositories ≥80%

## Acceptance criteria
- `npm test` (unit) < 60 s; `npm run test:integration` reliable (no flaky retries needed, 3 consecutive green runs)
- Every acceptance criterion in TASK-01…06 has at least one automated test tracing to it (traceability table in `src/tests/TRACEABILITY.md`)

## Schema/contract change requests
_(append here)_
