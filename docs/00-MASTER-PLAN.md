# Finance Butler AI — Master Plan

> AI Personal Finance Assistant on LINE. Behaves like a personal financial secretary that understands Thai naturally.
> This document is the single source of truth for scope, technical decisions, and work division.

---

## 1. Requirements Analysis

### 1.1 What the user does (via LINE chat)

| Capability | Example input | System behavior |
|---|---|---|
| Record expense | `กินข้าว 80`, `กาแฟ Amazon 75` | Parse amount + merchant + category, save, confirm with Flex Message |
| Record income | `เงินเดือน 35000`, `โบนัส 5000` | Classify as income, save to default account |
| Relative dates | `เมื่อวานกินข้าว 70`, `15 ก.ค. ค่าไฟ 900` | Resolve Thai date words to absolute dates (user timezone Asia/Bangkok) |
| Send bank slip image | (image) | OCR + QR decode → extract bank/amount/ref/sender/receiver → ask "บันทึกเป็นรายรับหรือรายจ่าย?" |
| Send receipt image | (image) | OCR → store name, line items, VAT, total → suggest category |
| Search | `กาแฟเดือนนี้`, `ค่าอาหารปีนี้` | Query transactions, reply with list + totals |
| Edit | `แก้รายการล่าสุดเป็น 150` | Mutate last/referenced transaction, confirm |
| Delete | `ลบรายการล่าสุด`, `ลบ #52` | Always confirm before delete (Quick Reply yes/no) |
| Statistics | `สรุปวันนี้`, `เดือนนี้` | Income/expense/balance, category ranking, trends |
| Budgets | set monthly/category budget | Alert at 50% / 80% / 100% |
| Goals | Buy Car 300,000 | Track progress |
| Investments | `ซื้อหุ้น NVDA 5000` | Record trade, track avg cost / P&L / allocation |
| Assets | house, car, gold | Net-worth tracking |
| Recurring | Netflix, rent, salary | Auto-create transactions on schedule |
| Reminders | daily 20:00 "วันนี้มีรายรับรายจ่ายเพิ่มเติมไหม" | Scheduled LINE push |
| Reports | Excel / CSV / PDF | Generated and delivered via link |
| Dashboard | web | React dashboard with charts (LINE Login) |
| Learning | user corrects a category | Correction remembered forever, applied to future parses |

### 1.2 Non-functional requirements

- **Scale**: thousands of users → stateless API workers, queue-based processing, Redis cache, indexed Postgres.
- **Latency**: LINE webhook must ACK fast → respond 200 immediately, process events asynchronously.
- **Correctness of money**: `Decimal(18,2)` everywhere. Never floats. DB transactions with rollback for multi-row mutations (transfers, trades).
- **Security**: LINE signature validation, JWT for dashboard, rate limiting, Helmet, CORS, input sanitization, webhook dedupe, audit log.
- **Cost control on AI**: hybrid parser — deterministic rules first (covers ~80% of messages, free, <1 ms), LLM only for ambiguous input.

---

## 2. Key Technical Decisions (trade-offs & recommendations)

| # | Decision | Options considered | **Chosen** | Why |
|---|---|---|---|---|
| D1 | AI provider | OpenAI vs **Claude API** | **Claude** (`claude-sonnet-5` for parsing, `claude-haiku-4-5` for cheap classification) | Strong Thai understanding, tool-use for guaranteed-structured extraction; Haiku keeps per-message cost negligible |
| D2 | NLP strategy | LLM-for-everything vs **hybrid (rules → LLM fallback)** | **Hybrid** | `กินข้าว 80` needs no LLM. Rules handle amount/date/keyword patterns deterministically and free; LLM handles ambiguity. Cuts AI cost ~80% and p50 latency to milliseconds |
| D3 | OCR | Google Vision vs Azure vs Tesseract | **Google Vision** primary, **Tesseract** fallback (dev / self-host) | Vision has the best Thai accuracy. Bonus: Thai bank slips carry an EMVCo/PromptPay-style QR — **decode the QR first**; it's more reliable than OCR for amount/ref. OCR fills the rest |
| D4 | Background jobs | node-cron vs **BullMQ (Redis)** | **BullMQ** | Durable, retries with backoff, horizontally scalable workers, delayed jobs (reminders), repeatable jobs (recurring transactions). node-cron dies with the process |
| D5 | Repo layout | Separate repos vs **monorepo (npm workspaces)** | **Monorepo**: `apps/backend`, `apps/dashboard`, `packages/shared` | Shared TypeScript types + Zod schemas between API and dashboard = the API contract is enforced by the compiler. Other AIs work in parallel on branches |
| D6 | DI approach | tsyringe/inversify vs **manual composition root** | **Manual composition root** (`container.ts`) | Constructor injection with interfaces (SOLID) without decorator magic; trivially testable, zero runtime deps, easier for multi-AI collaboration to reason about |
| D7 | Dashboard auth | Custom auth vs **LINE Login (OIDC) → JWT** | **LINE Login** | One identity across bot + dashboard; user never creates a password |
| D8 | Deletes | Hard delete vs **soft delete (`deletedAt`)** | **Soft delete** for transactions | Undo support, audit trail, safer with chat-driven destructive commands |
| D9 | Webhook dedupe | DB unique vs **Redis SETNX + DB unique** | **Both** | Redis catches retries fast; DB `webhookEventId` unique constraint is the hard guarantee |
| D10 | File storage | Local disk vs **S3-compatible** | **S3-compatible** (MinIO locally via Docker, R2/S3/Spaces in prod) | Stateless workers require external storage; presigned URLs for dashboard |

---

## 3. Work Division (multi-AI plan)

Core rule: **`packages/shared` + `prisma/schema.prisma` + `docs/04-API-CONTRACTS.md` are the contracts.** Only TASK-01 (core) may change them; everyone else consumes them.

| Task file | Owner | Branch | Depends on |
|---|---|---|---|
| [TASK-01-CORE-BACKEND.md](../tasks/TASK-01-CORE-BACKEND.md) | **Claude (this session — core)** | `main` / `feat/core-*` | — |
| [TASK-02-DASHBOARD-UI.md](../tasks/TASK-02-DASHBOARD-UI.md) | UI AI | `feat/dashboard` | API contract (mock server provided) |
| [TASK-03-OCR-PIPELINE.md](../tasks/TASK-03-OCR-PIPELINE.md) | OCR AI | `feat/ocr` | `IOcrProvider` interface from core |
| [TASK-04-LINE-RICH-UI.md](../tasks/TASK-04-LINE-RICH-UI.md) | LINE UI AI | `feat/line-ui` | `IMessageBuilder` interface from core |
| [TASK-05-REPORTS-EXPORTS.md](../tasks/TASK-05-REPORTS-EXPORTS.md) | Reports AI | `feat/reports` | Repositories from core |
| [TASK-06-DEVOPS.md](../tasks/TASK-06-DEVOPS.md) | DevOps AI | `feat/devops` | Dockerfiles buildable once core scaffold exists |
| [TASK-07-QA-TESTING.md](../tasks/TASK-07-QA-TESTING.md) | QA AI | `feat/qa` | Runs against every merged feature |

Coordination rules live in [tasks/TASK-00-COORDINATION.md](../tasks/TASK-00-COORDINATION.md).

---

## 4. Milestones

1. **M0 — Foundation (this repo state)**: architecture docs, Prisma schema, monorepo scaffold, contracts. ✅
2. **M1 — Core loop**: webhook → Thai parser → transaction saved → Flex confirmation. Registration on follow. (TASK-01)
3. **M2 — Money graph**: accounts, transfers, categories + AI classification + correction memory. (TASK-01)
4. **M3 — Vision**: slip QR/OCR + receipt pipeline. (TASK-03, integrates via core interfaces)
5. **M4 — Insight**: search, statistics, budgets + alerts, goals. (TASK-01 + TASK-04 for rendering)
6. **M5 — Automation**: recurring transactions, reminders, BullMQ workers. (TASK-01)
7. **M6 — Surface**: dashboard (TASK-02), reports/exports (TASK-05).
8. **M7 — Ship**: Docker, CI, deployment guides (TASK-06), full test pass (TASK-07).

---

## 5. Document map

- [01-ARCHITECTURE.md](01-ARCHITECTURE.md) — Clean Architecture layers, DI, folder structure
- [02-DATABASE.md](02-DATABASE.md) — schema design rationale (schema itself: `apps/backend/prisma/schema.prisma`)
- [03-WORKFLOWS.md](03-WORKFLOWS.md) — sequence diagrams for every major flow
- [04-API-CONTRACTS.md](04-API-CONTRACTS.md) — REST API for the dashboard (UI AI works from this alone)
