/** View models consumed by message builders (TASK-04) and the dashboard. Amounts are formatted-ready decimal strings. */

export interface TxnView {
  id: string;
  shortRef: number;
  type: string;
  amount: string;
  currency: string;
  description: string;
  categoryName: string;
  categoryIcon: string;
  accountName: string;
  /** ISO date */
  occurredAt: string;
  /** group-ledger mode: who recorded/paid this */
  actorName?: string;
}

export interface CategoryRankView {
  name: string;
  icon: string;
  amount: string;
  pct: number;
}

export interface StatsView {
  period: "day" | "week" | "month" | "quarter" | "year";
  /** local YYYY-MM-DD anchoring the summarized period */
  anchor: string;
  /** anchor of the previous period (for the ◀ button) */
  prevAnchor: string;
  /** anchor of the next period; absent when it lies in the future */
  nextAnchor?: string;
  periodLabel: string;
  income: string;
  expense: string;
  net: string;
  totalBalance: string;
  txnCount: number;
  /** expense change vs the previous period in %; null when previous is 0 */
  expenseChangePct: number | null;
  topCategories: CategoryRankView[];
  /** group-ledger mode: outflow per member; empty for personal ledgers */
  payerBreakdown: CategoryRankView[];
}

export interface CategoryView {
  id: string;
  key: string | null;
  name: string;
  nameTh: string;
  icon: string;
}

export interface AccountView {
  id: string;
  name: string;
  type: string;
  balance: string;
}

export interface BudgetAlertView {
  categoryName: string;
  level: number;
  spent: string;
  limit: string;
}

export interface GoalView {
  name: string;
  current: string;
  target: string;
  pct: number;
}

export interface SlipView {
  slipId: string;
  bank?: string;
  amount: string;
  senderName?: string;
  receiverName?: string;
  transDate?: string;
}

export interface ReceiptView {
  receiptId: string;
  storeName?: string;
  total: string;
  itemCount: number;
  suggestedCategory?: string;
}

export type ErrorKind = "not_found" | "cannot_parse" | "internal" | "not_yet";
