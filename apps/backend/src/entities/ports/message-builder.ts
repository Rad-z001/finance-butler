import type { messagingApi } from "@line/bot-sdk";
import type {
  AccountView,
  BudgetAlertView,
  CategoryView,
  ErrorKind,
  GoalView,
  ReceiptView,
  SlipView,
  StatsView,
  TxnView,
} from "@finance-butler/shared";

export type LineMessage = messagingApi.Message;

/**
 * Everything the user sees in LINE. Implemented minimally by core
 * (line/messages/core-builder.ts) and replaced with polished Flex designs by TASK-04.
 * Implementations must be pure — no I/O.
 */
export interface IMessageBuilder {
  welcome(displayName: string): LineMessage[];
  welcomeGroup(groupName: string): LineMessage[];
  txnSaved(txn: TxnView, accountBalance: string): LineMessage[];
  txnList(items: TxnView[], totalAmount: string, title: string): LineMessage[];
  statsSummary(stats: StatsView): LineMessage[];
  deleteConfirm(txn: TxnView): LineMessage[];
  deleted(txn: TxnView): LineMessage[];
  restored(txn: TxnView): LineMessage[];
  edited(txn: TxnView): LineMessage[];
  categoryPicker(txnId: string, categories: CategoryView[]): LineMessage[];
  slipConfirm(slip: SlipView): LineMessage[];
  receiptConfirm(receipt: ReceiptView): LineMessage[];
  budgetAlert(alert: BudgetAlertView): LineMessage[];
  goalProgress(goal: GoalView): LineMessage[];
  accountPicker(accounts: AccountView[]): LineMessage[];
  dailyReminder(): LineMessage[];
  help(): LineMessage[];
  error(kind: ErrorKind): LineMessage[];
}
