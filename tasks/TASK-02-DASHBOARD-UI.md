# TASK-02 — Dashboard UI (Owner: UI AI) — branch `feat/dashboard`

Build the responsive web dashboard in `apps/dashboard/`. **You can start immediately** — work against the mock API (`npm run mock:api` in `apps/backend`, same contract as production).

## Stack (fixed)
React 18 + Vite + TypeScript strict + TailwindCSS + **ECharts** (`echarts-for-react`) + TanStack Query + React Router. Import types/schemas from `packages/shared` — do not redeclare API types.

## Read first
`docs/04-API-CONTRACTS.md` (your entire backend surface) · `docs/00-MASTER-PLAN.md` §1 · `tasks/TASK-00-COORDINATION.md`

## Pages
1. **Login** — "Sign in with LINE" → `/auth/line`; handle callback, store access token (memory) + auto-refresh via `/auth/refresh`
2. **Overview** — net worth, month income/expense/balance stat cards; daily trend area chart; category donut; budget progress bars; recent transactions
3. **Transactions** — filterable/paginated table (date range, type, category, account, text search), inline edit, soft-delete with undo toast, CSV of current view
4. **Accounts** — cards per account (bank logos/colors for SCB/KBank/KTB/BBL/TrueMoney), transfer modal, balance history sparkline
5. **Budgets** — set monthly/category budgets, usage gauges, alert-level indicator
6. **Goals** — progress cards, contribute action
7. **Investments** — holdings table (qty, avg cost, invested, P&L), allocation pie
8. **Assets** — net-worth composition
9. **Reports** — request xlsx/csv/pdf, poll job status, download
10. **Settings** — timezone, language (TH default / EN), default account, daily reminder time

## Requirements
- Mobile-first responsive (users arrive from LINE on phones); test at 375 px
- i18n: `th` default, `en` secondary (use a light i18n lib or a typed dictionary)
- Thai Baht formatting: `฿4,930.00`; Buddhist-era year toggle in settings (display only)
- Dark/light theme; ECharts must re-theme with it
- Loading skeletons + error states on every query; never blank-screen
- Charts: label axes, tooltips in Thai, currency-formatted

## Acceptance criteria
- Runs standalone against mock API with zero backend changes
- Lighthouse mobile ≥ 90 performance/accessibility on Overview
- `npm run typecheck && npm run lint && npm test` green (component tests for the transactions table + one chart)

## Schema/contract change requests
_(append here — TASK-01 will action)_
