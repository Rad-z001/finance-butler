# 04 — REST API Contract (Dashboard ↔ Backend)

Consumed by TASK-02 (Dashboard UI). Base URL: `/api/v1`. All responses:

```jsonc
{ "success": true,  "data": { ... } }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "..." } }
```

Auth: `Authorization: Bearer <JWT>` on everything except `/auth/*`. Amounts are **strings** (decimal-safe), dates ISO-8601. Pagination: `?page=1&limit=50` → `data.items`, `data.total`, `data.page`.
Zod schemas for every payload live in `packages/shared/src/schemas/` — dashboard imports them directly; this file is the human-readable view.

## Auth
| Method | Path | Body → Data |
|---|---|---|
| GET | `/auth/line` | → redirect to LINE Login |
| GET | `/auth/line/callback?code=` | → sets refresh cookie, returns `{ accessToken, user }` |
| POST | `/auth/refresh` | (cookie) → `{ accessToken }` |
| POST | `/auth/logout` | → clears cookie |

`user`: `{ id, displayName, pictureUrl, timezone, language }`

## Overview
| GET `/overview?month=2026-07` | → `{ income, expense, balance, netWorth, budgetUsage: [{categoryId, name, spent, limit, pct}], recentTransactions: Txn[10], dailyTrend: [{date, income, expense}], categoryRanking: [{categoryId, name, icon, amount, pct}] }` |
|---|---|

## Transactions
| Method | Path | Notes |
|---|---|---|
| GET | `/transactions` | filters: `from,to,type,categoryId,accountId,tag,q,minAmount,maxAmount` + pagination |
| POST | `/transactions` | `{ type, amount, currency?, categoryId?, accountId, toAccountId?, description?, occurredAt, tags?[] }` |
| GET/PATCH/DELETE | `/transactions/:id` | PATCH accepts partial body; DELETE = soft delete |
| GET | `/transactions/:id/attachments` | → presigned URLs |

`Txn`: `{ id, shortRef, type, amount, currency, description, merchant, occurredAt, source, category?: {id,name,nameTh,icon}, account: {id,name,type}, toAccount?, tags: string[] }`

## Accounts
GET/POST `/accounts`, PATCH/DELETE `/accounts/:id`, POST `/accounts/transfer` `{ fromId, toId, amount, note? }`
`Account`: `{ id, name, type, provider, currency, balance, creditLimit?, isDefault, isArchived }`

## Categories
GET `/categories` (system + own), POST/PATCH/DELETE `/categories/:id` (own only)

## Budgets
GET/POST `/budgets`, PATCH/DELETE `/budgets/:id` — `{ categoryId?, period, amount, alertLevels }` + computed `{ spent, pct }` on GET

## Goals
GET/POST `/goals`, PATCH/DELETE `/goals/:id`, POST `/goals/:id/contribute` `{ amount, accountId }`

## Investments
GET `/investments` → holdings with `{ symbol, type, quantity, avgCost, invested, marketValue?, pnl?, allocationPct }`
POST `/investments/trades` `{ symbol, type, side: BUY|SELL, quantity, price, fee?, accountId, tradedAt }`
GET `/investments/:id/trades`

## Assets
GET/POST `/assets`, PATCH/DELETE `/assets/:id` — `{ name, type, purchasePrice, currentValue, purchasedAt? }`

## Recurring & Reminders
GET/POST/PATCH/DELETE `/recurring`, `/reminders`

## Stats
| GET `/stats/summary?period=day|week|month|quarter|year&date=` | totals + category ranking |
|---|---|
| GET `/stats/trend?granularity=daily|monthly&from=&to=` | time series |
| GET `/stats/compare?year=2026&against=2025` | year comparison |
| GET `/stats/cashflow?year=2026` | monthly in/out/net |

## Reports
POST `/reports` `{ type: monthly|yearly|category, format: xlsx|csv|pdf, params }` → `{ jobId }`
GET `/reports/:jobId` → `{ status, downloadUrl? }`

## Settings
GET/PATCH `/settings` — `{ timezone, language, defaultAccountId, dailyReminderTime? }`

## Error codes
`UNAUTHORIZED` `FORBIDDEN` `NOT_FOUND` `VALIDATION_ERROR` `RATE_LIMITED` `CONFLICT` `INTERNAL`

## Mock server
`apps/backend` ships `npm run mock:api` (json fixtures, same contract) so TASK-02 never blocks on the real backend.
