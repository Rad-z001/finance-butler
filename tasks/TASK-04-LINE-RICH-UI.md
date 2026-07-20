# TASK-04 — LINE Rich UI (Owner: LINE UI AI) — branch `feat/line-ui`

Everything the user *sees* in LINE: Flex Messages, Quick Replies, carousels, Rich Menu. In `apps/backend/src/line/messages/` + `src/line/rich-menu/`.

## Read first
`docs/03-WORKFLOWS.md` (every flow ends in a message you build) · `tasks/TASK-00-COORDINATION.md`

## Interface to implement (`src/entities/ports/message-builder.ts`)
```ts
interface IMessageBuilder {
  txnSaved(txn: TxnView, balance: string): FlexMessage;        // ✅ + edit/delete quick replies
  txnList(items: TxnView[], total: string): FlexMessage;       // search results, carousel if >5
  statsSummary(s: StatsView): FlexMessage;                     // period summary card w/ bar viz
  slipConfirm(slip: SlipView): FlexMessage;                    // income/expense/cancel buttons
  receiptConfirm(r: ReceiptView): FlexMessage;                 // items + suggested category
  deleteConfirm(txn: TxnView): FlexMessage;
  budgetAlert(b: BudgetAlertView): FlexMessage;
  goalProgress(g: GoalView): FlexMessage;
  categoryPicker(cats: CategoryView[]): FlexMessage;           // carousel of categories
  accountPicker(accts: AccountView[]): FlexMessage;
  dailyReminder(): Message;                                    // + quick replies
  help(): FlexMessage;
  error(kind: ErrorKind): Message;                             // friendly Thai fallbacks
}
```
View types live in `packages/shared`. Pure functions — no I/O, no SDK client calls; return LINE message JSON only. This makes every builder snapshot-testable.

## Deliverables
1. All builders above, validated against LINE Flex Message schema (use `@line/bot-sdk` types; keep within size limits — bubbles ≤ 10 KB, carousel ≤ 12 bubbles)
2. **Design system**: consistent palette (income green #06C755-family, expense red, neutral grays), category emoji set, Thai typography that renders well in LINE
3. **Rich Menu**: 2×3 grid — [+ รายจ่าย] [+ รายรับ] [สรุปเดือนนี้] [งบประมาณ] [Dashboard (LIFF/URL)] [ช่วยเหลือ] — image assets (2500×1686 PNG) + `rich-menu.ts` setup script (`npm run line:richmenu`)
4. **Postback protocol**: `action=confirm_txn&id=...` style query-string payloads; document all postback routes in `src/line/messages/POSTBACKS.md` (core's dispatcher consumes this)
5. Snapshot tests for every builder with fixture views

## Acceptance criteria
- Every builder output passes LINE's Flex validator (round-trip in tests)
- All copy in natural Thai, amounts formatted `−1,200฿`, dates Thai style (`15 ก.ค.`)
- Rich menu script idempotent (re-run replaces, not duplicates)

## Schema/contract change requests
_(append here)_
