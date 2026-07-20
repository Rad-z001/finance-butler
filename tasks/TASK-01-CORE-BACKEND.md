# TASK-01 — Core Backend (Owner: Claude — this session)

The spine of the system. Owns all contracts (`prisma/schema.prisma`, `packages/shared`, API contract) and the money-critical logic.

## Scope

### 1. Foundation
- [x] Monorepo scaffold (npm workspaces), strict tsconfig, ESLint/Prettier
- [x] Prisma schema (all 20+ models), seed (system categories, bank providers)
- [x] Zod-validated env config, pino structured logging
- [x] DI composition root (`container.ts`), typed domain errors + error-handler middleware

### 2. LINE plumbing
- [x] Webhook route: raw-body HMAC signature validation → 200 fast → enqueue
- [x] BullMQ `line-events` queue + worker, Redis dedupe + `WebhookEvent` unique
- [x] Follow event → auto-register user (profile fetch, timezone Asia/Bangkok, default Cash account)
- [x] Reply/push wrappers over `@line/bot-sdk` behind `ILineMessenger` port

### 3. Thai NLP (the heart)
- [x] `ThaiRuleParser`: amount extraction (`80`, `1,200`, `1.2k`, `80บาท`), Thai date resolver (วันนี้/เมื่อวาน/พรุ่งนี้/วันจันทร์/15 ก.ค./1/7/เดือนที่แล้ว), keyword→category map, merchant capture
- [x] `CategoryCorrection` lookup (user's past corrections win over everything)
- [x] Claude fallback: tool-use forced JSON → `ParsedIntent` (shared discriminated union); Sonnet for ambiguous parses, Haiku for Q&A
- [x] Command router: สรุปวันนี้/สัปดาห์นี้/เดือนนี้/ปีนี้, ลบ/แก้ล่าสุด, search phrases
- [ ] Conversation state machine in Redis (M1 uses postback-carried state; Redis state needed for multi-step flows in M3)

### 4. Money services (all inside `prisma.$transaction`, all audited)
- [x] TransactionService: create/edit/delete(soft)/restore, shortRef allocation, balance updates, chat search
- [ ] AccountService: CRUD + transfers (M2); CategoryService ✅ (with correction learning)
- [ ] StatsService: summaries + rankings ✅; trends, year compare, cashflow + Redis cache (M4)
- [ ] BudgetService (threshold alerts 50/80/100), GoalService, InvestmentService (avg-cost, P&L), AssetService
- [ ] RecurringService + ReminderService with BullMQ repeatable jobs (idempotent)

### 5. REST API for dashboard
- [ ] Implement `docs/04-API-CONTRACTS.md` exactly; LINE Login OIDC → JWT; `npm run mock:api` fixture server for TASK-02

## Ports published for other tasks (in `src/entities/ports/`)
```ts
IOcrProvider        // TASK-03 implements
ISlipExtractor, IReceiptExtractor
IMessageBuilder     // TASK-04 implements (Flex/QuickReply builders)
IReportGenerator    // TASK-05 implements
```

## Acceptance criteria
- `กินข้าว 80` → saved transaction + Flex reply, no LLM call, <200 ms processing
- `เมื่อวานกินข้าว 70` → dated yesterday in Asia/Bangkok
- Rule-parser coverage ≥80% on the test corpus in `src/tests/fixtures/thai-messages.json`
- Duplicate webhook delivery → exactly one transaction
- Transfer failure mid-way → both balances unchanged (rollback test)
- All API endpoints match contract (integration tests)
