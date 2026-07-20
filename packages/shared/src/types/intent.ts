import type { BudgetPeriod, TransactionType } from "../constants/index.js";

/**
 * ParsedIntent — the single contract between NLP (rules or Claude) and the services.
 * Every user text message resolves to exactly one of these.
 * Amounts are decimal strings ("80", "1200.50") — never floats.
 * Dates are ISO-8601 date strings resolved in the user's timezone.
 */
export type ParsedIntent =
  | AddTransactionIntent
  | SearchIntent
  | EditIntent
  | DeleteIntent
  | RestoreIntent
  | StatsIntent
  | SetBudgetIntent
  | AddGoalIntent
  | TransferIntent
  | QuestionIntent
  | UnknownIntent;

export interface AddTransactionIntent {
  kind: "add_transaction";
  type: TransactionType;
  amount: string;
  description: string;
  /** merchant or free-text hint the classifier uses, e.g. "กาแฟ Amazon" → "Amazon" */
  merchant?: string;
  categoryHint?: string;
  accountHint?: string;
  /** ISO date; defaults to today in user tz when absent from the message */
  occurredAt: string;
  /** which layer produced this parse — for metrics & debugging */
  parsedBy: "correction" | "rules" | "ai";
  confidence: number;
}

export interface SearchIntent {
  kind: "search";
  query: {
    text?: string;
    categoryHint?: string;
    from?: string;
    to?: string;
    type?: TransactionType;
    minAmount?: string;
    maxAmount?: string;
  };
}

export type TxnRef = { by: "last" } | { by: "shortRef"; shortRef: number };

export interface EditIntent {
  kind: "edit";
  ref: TxnRef;
  patch: {
    amount?: string;
    categoryHint?: string;
    accountHint?: string;
    description?: string;
    occurredAt?: string;
  };
}

export interface DeleteIntent {
  kind: "delete";
  ref: TxnRef;
}

export interface RestoreIntent {
  kind: "restore";
  ref: TxnRef;
}

export interface StatsIntent {
  kind: "stats";
  period: "day" | "week" | "month" | "quarter" | "year";
  /** anchor date for the period, ISO; today when omitted */
  date?: string;
}

export interface SetBudgetIntent {
  kind: "set_budget";
  amount: string;
  period: BudgetPeriod;
  categoryHint?: string;
}

export interface AddGoalIntent {
  kind: "add_goal";
  name: string;
  targetAmount: string;
  targetDate?: string;
}

export interface TransferIntent {
  kind: "transfer";
  amount: string;
  fromAccountHint?: string;
  toAccountHint?: string;
}

export interface QuestionIntent {
  kind: "question";
  text: string;
}

export interface UnknownIntent {
  kind: "unknown";
  text: string;
}
