# 01 — Architecture

Clean Architecture with a pragmatic Node.js shape. Dependencies always point **inward**: HTTP/LINE/OCR/AI are details; the domain doesn't know they exist.

## 1. Layers

```
┌────────────────────────────────────────────────────────────┐
│  Interface layer                                           │
│  controllers/  routes/  middlewares/  line/ (webhook I/O)  │
├────────────────────────────────────────────────────────────┤
│  Application layer                                         │
│  services/ (use cases)  dtos/  validators/ (zod)           │
├────────────────────────────────────────────────────────────┤
│  Domain layer                                              │
│  entities/  types/  domain errors  interfaces (ports):     │
│  ITransactionRepository, IOcrProvider, IAiClient,          │
│  IMessageBuilder, IStorage, IClock                         │
├────────────────────────────────────────────────────────────┤
│  Infrastructure layer                                      │
│  repositories/ (Prisma)  ai/ (Claude)  ocr/ (Vision)       │
│  line/ (SDK client)  storage/ (S3)  cache/ (Redis)         │
│  jobs/ (BullMQ)                                            │
└────────────────────────────────────────────────────────────┘
```

**Rules**
- Services depend on **interfaces** (ports), never on Prisma/LINE/Claude SDKs directly.
- Repositories are the only code that touches Prisma. One repository per aggregate.
- DTOs (zod schemas in `packages/shared`) validate every boundary: webhook payloads, REST bodies, LLM tool outputs.
- Errors: typed domain errors (`NotFoundError`, `ValidationError`, `InsufficientPermissionError`) mapped to HTTP/LINE replies in one place (`middlewares/error-handler.ts`).

## 2. Dependency Injection

Manual **composition root** — `src/container.ts` wires concrete implementations into constructors at boot:

```ts
const prisma = new PrismaClient();
const txnRepo: ITransactionRepository = new PrismaTransactionRepository(prisma);
const ai: IAiClient = new ClaudeClient(env.ANTHROPIC_API_KEY);
const parser = new MessageParser(new ThaiRuleParser(), ai, correctionRepo);
const txnService = new TransactionService(txnRepo, accountRepo, auditRepo, clock);
```

Tests construct services with in-memory fakes. No decorators, no reflection, no framework lock-in. (Trade-off vs tsyringe documented in [00-MASTER-PLAN.md](00-MASTER-PLAN.md) D6.)

## 3. Message-processing pipeline (the core)

```
LINE webhook POST
  → signature check → 200 OK immediately
  → enqueue event (BullMQ "line-events", dedupe by webhookEventId)
     → worker: resolve user (auto-register on first contact)
     → route by event type:
        text   → MessageParser
                  1. Command router (exact commands: สรุปวันนี้, ลบรายการล่าสุด …)
                  2. ThaiRuleParser (regex/keyword: amount, date words, category)
                  3. Claude fallback (tool-use → strict ParsedIntent JSON)
                  → IntentDispatcher → Service (Transaction/Search/Budget/…)
        image  → OCR queue (slip vs receipt detection → extract → confirm flow)
        follow → UserService.register
        postback → ConfirmationService (yes/no, category pick, account pick)
     → reply via IMessageBuilder (Flex/QuickReply) — built in line/messages/
```

`ParsedIntent` is a discriminated union in `packages/shared` — the single contract between NLP and services:

```ts
type ParsedIntent =
  | { kind: "add_transaction"; type: TxnType; amount: number; description: string;
      categoryHint?: string; accountHint?: string; occurredAt: string }
  | { kind: "search"; query: SearchQuery }
  | { kind: "edit_last"; patch: TxnPatch } | { kind: "delete"; ref: TxnRef }
  | { kind: "stats"; period: Period }     | { kind: "set_budget"; ... }
  | { kind: "question"; text: string }    | { kind: "unknown"; text: string }
```

## 4. Processes

| Process | Entry | Responsibility |
|---|---|---|
| `api` | `src/server.ts` | Express: LINE webhook + REST API for dashboard |
| `worker` | `src/worker.ts` | BullMQ consumers: line-events, ocr, notifications, exports |
| `scheduler` | inside worker | BullMQ repeatables: recurring txns, reminders, budget scans (cron via Redis, survives restarts) |

All stateless → scale horizontally behind a load balancer. Redis holds: webhook dedupe keys, conversation state (pending confirmations, TTL 10 min), rate-limit counters, hot query cache (monthly summaries).

## 5. Folder structure (monorepo)

```
finance-butler/
├─ package.json                  # npm workspaces
├─ docker-compose.yml            # postgres, redis, minio, api, worker, dashboard
├─ docs/                         # you are here
├─ tasks/                        # multi-AI work assignments
├─ packages/
│  └─ shared/                    # THE CONTRACT — types + zod schemas + constants
│     └─ src/{types,schemas,constants}/
├─ apps/
│  ├─ backend/
│  │  ├─ prisma/schema.prisma    # THE CONTRACT — database
│  │  ├─ .env.example
│  │  └─ src/
│  │     ├─ config/              # zod-validated env
│  │     ├─ container.ts         # DI composition root
│  │     ├─ server.ts  worker.ts app.ts
│  │     ├─ routes/  controllers/  middlewares/  validators/
│  │     ├─ services/            # use cases (transaction, account, budget, goal,
│  │     │                       #  investment, asset, recurring, reminder, stats,
│  │     │                       #  search, user, confirmation, report)
│  │     ├─ repositories/        # Prisma impls of domain ports
│  │     ├─ entities/            # domain types + ports (interfaces)
│  │     ├─ nlp/                 # thai-parser (rules), date-resolver, intent types
│  │     ├─ ai/                  # Claude client, prompts, tool schemas, classifier
│  │     ├─ ocr/                 # IOcrProvider impls (vision, tesseract), qr-decoder,
│  │     │                       #  slip-extractor, receipt-extractor   [TASK-03]
│  │     ├─ line/                # SDK client, signature, messages/ (flex builders)
│  │     │                       #  rich-menu                          [TASK-04]
│  │     ├─ jobs/                # BullMQ queues + processors
│  │     ├─ storage/  cache/     # S3, Redis adapters
│  │     ├─ reports/             # xlsx/csv/pdf generators              [TASK-05]
│  │     ├─ utils/  types/
│  │     └─ tests/               # unit/ integration/ e2e/              [TASK-07]
│  └─ dashboard/                 # React + Vite + Tailwind + ECharts    [TASK-02]
│     └─ src/{pages,components,api,hooks,lib}/
```

## 6. Security checklist (enforced in core)

- `x-line-signature` HMAC-SHA256 validation on raw body (before JSON parse)
- Webhook dedupe: Redis `SETNX line:evt:{id}` + unique column
- JWT (RS256) for dashboard, issued after LINE Login verification; 15-min access + refresh
- `express-rate-limit` backed by Redis (per-IP for API, per-user for bot commands)
- Helmet, strict CORS allowlist, zod validation on every input, Prisma = parameterized queries
- Multi-row money mutations inside `prisma.$transaction` (transfer, trade, recurring batch)
- AuditLog row for every mutation (who/what/before/after)
- Secrets only via env; `.env` gitignored, `.env.example` maintained
