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
}

export interface CategoryRankView {
  name: string;
  icon: string;
  amount: string;
  pct: number;
}

export interface StatsView {
  periodLabel: string;
  income: string;
  expense: string;
  net: string;
  totalBalance: string;
  txnCount: number;
  topCategories: CategoryRankView[];
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
