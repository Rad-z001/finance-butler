import { z } from "zod";
import { ACCOUNT_TYPES, BUDGET_PERIODS, TRANSACTION_TYPES } from "../constants/index.js";

/** Decimal amount as string, e.g. "1200.50". Guards against float payloads. */
export const zAmount = z
  .string()
  .regex(/^\d{1,16}(\.\d{1,2})?$/, "amount must be a decimal string with ≤2 dp");

export const zIsoDate = z.string().datetime({ offset: true }).or(z.string().date());

export const zCreateTransaction = z.object({
  type: z.enum(TRANSACTION_TYPES),
  amount: zAmount,
  currency: z.string().length(3).default("THB"),
  categoryId: z.string().cuid().optional(),
  accountId: z.string().cuid(),
  toAccountId: z.string().cuid().optional(),
  description: z.string().max(500).optional(),
  merchant: z.string().max(200).optional(),
  occurredAt: zIsoDate,
  tags: z.array(z.string().max(50)).max(10).default([]),
});
export type CreateTransactionDto = z.infer<typeof zCreateTransaction>;

export const zPatchTransaction = zCreateTransaction.partial();
export type PatchTransactionDto = z.infer<typeof zPatchTransaction>;

export const zTransactionFilters = z.object({
  from: zIsoDate.optional(),
  to: zIsoDate.optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  categoryId: z.string().cuid().optional(),
  accountId: z.string().cuid().optional(),
  tag: z.string().optional(),
  q: z.string().max(200).optional(),
  minAmount: zAmount.optional(),
  maxAmount: zAmount.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type TransactionFiltersDto = z.infer<typeof zTransactionFilters>;

export const zCreateAccount = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(ACCOUNT_TYPES),
  provider: z.string().max(50).optional(),
  currency: z.string().length(3).default("THB"),
  balance: zAmount.default("0"),
  creditLimit: zAmount.optional(),
  isDefault: z.boolean().default(false),
});
export type CreateAccountDto = z.infer<typeof zCreateAccount>;

export const zTransfer = z.object({
  fromId: z.string().cuid(),
  toId: z.string().cuid(),
  amount: zAmount,
  note: z.string().max(300).optional(),
});
export type TransferDto = z.infer<typeof zTransfer>;

export const zCreateBudget = z.object({
  categoryId: z.string().cuid().optional(),
  period: z.enum(BUDGET_PERIODS),
  amount: zAmount,
  alertLevels: z.array(z.number().int().min(1).max(100)).default([50, 80, 100]),
});
export type CreateBudgetDto = z.infer<typeof zCreateBudget>;

/** Uniform API envelope */
export const zApiError = z.object({
  code: z.enum([
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "VALIDATION_ERROR",
    "RATE_LIMITED",
    "CONFLICT",
    "INTERNAL",
  ]),
  message: z.string(),
});
export type ApiError = z.infer<typeof zApiError>;
