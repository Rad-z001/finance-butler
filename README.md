# 🤵 Finance Butler AI

AI personal finance assistant on **LINE** that understands **Thai naturally**. Chat `กินข้าว 80` and it records, categorizes, budgets, reminds, and reports — like a personal financial secretary.

> **Status: M0 — Foundation.** Architecture, contracts, and core scaffold are in place. See the [Master Plan](docs/00-MASTER-PLAN.md) for the roadmap and [tasks/](tasks/) for the multi-AI work split.

## What it does

- 💬 Record income/expenses from natural Thai chat (`เมื่อวานกินข้าว 70`, `เงินเดือน 35000`)
- 📸 Read bank slips (QR + OCR) and receipts (items, VAT, total)
- 🏦 Multiple accounts: cash, SCB/KBank/KTB/BBL, TrueMoney, credit cards, crypto, investments
- 📊 Summaries, trends, category rankings, cash flow, year comparisons
- 🎯 Budgets with 50/80/100% alerts, savings goals, investment P&L, asset tracking
- 🔁 Recurring transactions (Netflix, rent, salary) and daily reminders
- 📈 React dashboard (ECharts) via LINE Login; Excel/CSV/PDF reports
- 🧠 Learns your corrections forever (`เปลี่ยนหมวดเป็นอาหาร`)

## Stack

Node.js · TypeScript (strict) · Express · PostgreSQL + Prisma · Redis + BullMQ · Claude API · Google Vision / Tesseract · S3-compatible storage · React + Vite + Tailwind + ECharts · Docker

## Repo layout

```
docs/       architecture, database, workflows, API contract   ← read first
tasks/      work assignments for each AI engineer (TASK-00…07)
packages/shared/   shared types + zod schemas (THE contract)
apps/backend/      Express API + BullMQ worker + Prisma
apps/dashboard/    React dashboard (TASK-02)
```

## Quick start (dev)

```bash
npm install
cp apps/backend/.env.example apps/backend/.env   # fill LINE + Anthropic keys
docker compose up -d postgres redis minio        # (compose file lands with TASK-06)
npm run -w apps/backend db:migrate
npm run -w apps/backend db:seed
npm run dev            # API :3000
npm run -w apps/backend dev:worker
```

Expose the webhook for LINE (dev): `npx ngrok http 3000` → set `https://…/webhook` in the [LINE Developers Console](https://developers.line.biz/console) (Messaging API → Webhook URL, enable webhook, disable auto-reply).

## Environment

Every variable is documented in [apps/backend/.env.example](apps/backend/.env.example) and validated at boot by [src/config/env.ts](apps/backend/src/config/env.ts) — the server refuses to start with a clear message if anything is missing.

## Documentation

| Doc | Contents |
|---|---|
| [00-MASTER-PLAN.md](docs/00-MASTER-PLAN.md) | Requirements, tech decisions + trade-offs, milestones, work division |
| [01-ARCHITECTURE.md](docs/01-ARCHITECTURE.md) | Clean Architecture layers, DI, pipeline, folder structure, security |
| [02-DATABASE.md](docs/02-DATABASE.md) | Schema rationale, ERD, indexes ([schema.prisma](apps/backend/prisma/schema.prisma)) |
| [03-WORKFLOWS.md](docs/03-WORKFLOWS.md) | Sequence diagrams for every flow |
| [04-API-CONTRACTS.md](docs/04-API-CONTRACTS.md) | REST contract for the dashboard |

Full deployment guides (Railway / Render / DigitalOcean / VPS), Docker, and LINE/OCR/AI setup walkthroughs land with [TASK-06](tasks/TASK-06-DEVOPS.md).
