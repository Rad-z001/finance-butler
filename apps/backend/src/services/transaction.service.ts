import { Prisma, type PrismaClient, type Transaction, type TransactionType } from "@prisma/client";
import type { SearchIntent, TxnRef, TxnView } from "@finance-butler/shared";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { formatAmount } from "../utils/money.js";
import { localDateToInstant } from "../utils/period.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export interface CreateTxnInput {
  userId: string;
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amount: string;
  description: string;
  merchant?: string;
  /** local YYYY-MM-DD in the user's tz */
  occurredAtLocal: string;
  tz: string;
  source: "NLP" | "MANUAL" | "OCR_SLIP" | "OCR_RECEIPT" | "RECURRING" | "API";
  /** group-ledger mode: which member recorded/paid this */
  actorLineUserId?: string;
  actorName?: string;
}

export type TxnWithRelations = Prisma.TransactionGetPayload<{
  include: { category: true; account: true };
}>;

/** Sign of a transaction's effect on the source account balance. */
function balanceEffect(type: TransactionType, amount: Prisma.Decimal): Prisma.Decimal {
  return type === "INCOME" ? amount : amount.negated();
}

export class TransactionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Atomic create: allocate per-user shortRef, insert, apply balance, audit —
   * all inside one DB transaction (rollback leaves balances untouched).
   */
  async create(input: CreateTxnInput): Promise<{ txn: TxnWithRelations; balance: Prisma.Decimal }> {
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0)) throw new ValidationError("amount must be positive");

    return this.prisma.$transaction(async (tx) => {
      const { nextTxnRef } = await tx.user.update({
        where: { id: input.userId },
        data: { nextTxnRef: { increment: 1 } },
        select: { nextTxnRef: true },
      });

      const txn = await tx.transaction.create({
        data: {
          userId: input.userId,
          shortRef: nextTxnRef - 1,
          accountId: input.accountId,
          categoryId: input.categoryId,
          type: input.type,
          amount,
          description: input.description,
          ...(input.merchant ? { merchant: input.merchant } : {}),
          ...(input.actorLineUserId ? { actorLineUserId: input.actorLineUserId } : {}),
          ...(input.actorName ? { actorName: input.actorName } : {}),
          source: input.source,
          occurredAt: localDateToInstant(input.occurredAtLocal, input.tz),
        },
        include: { category: true, account: true },
      });

      const account = await tx.account.update({
        where: { id: input.accountId },
        data: { balance: { increment: balanceEffect(input.type, amount) } },
        select: { balance: true },
      });

      await tx.auditLog.create({
        data: {
          userId: input.userId,
          action: "transaction.create",
          entity: "Transaction",
          entityId: txn.id,
          after: { shortRef: txn.shortRef, type: txn.type, amount: input.amount },
        },
      });

      return { txn, balance: account.balance };
    });
  }

  async findById(userId: string, id: string): Promise<TxnWithRelations> {
    const txn = await this.prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
      include: { category: true, account: true },
    });
    if (!txn) throw new NotFoundError("รายการ");
    return txn;
  }

  async findByRef(userId: string, ref: TxnRef, includeDeleted = false): Promise<TxnWithRelations> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(includeDeleted ? {} : { deletedAt: null }),
      ...(ref.by === "shortRef" ? { shortRef: ref.shortRef } : {}),
    };
    const txn = await this.prisma.transaction.findFirst({
      where,
      orderBy: { createdAt: "desc" },
      include: { category: true, account: true },
    });
    if (!txn) {
      throw new NotFoundError("รายการ", ref.by === "shortRef" ? `#${ref.shortRef}` : "ล่าสุด");
    }
    return txn;
  }

  /** Edit amount/category/account; balance deltas applied atomically. */
  async edit(
    userId: string,
    ref: TxnRef,
    patch: { amount?: string; categoryId?: string; accountId?: string; description?: string },
  ): Promise<TxnWithRelations> {
    const current = await this.findByRef(userId, ref);
    return this.prisma.$transaction(async (tx) => {
      // reverse old effect, apply new — handles amount and account moves uniformly
      const oldEffect = balanceEffect(current.type, current.amount);
      const newAmount = patch.amount ? new Prisma.Decimal(patch.amount) : current.amount;
      if (newAmount.lte(0)) throw new ValidationError("amount must be positive");
      const newAccountId = patch.accountId ?? current.accountId;
      const newEffect = balanceEffect(current.type, newAmount);

      if (!newAmount.eq(current.amount) || newAccountId !== current.accountId) {
        await tx.account.update({
          where: { id: current.accountId },
          data: { balance: { decrement: oldEffect } },
        });
        await tx.account.update({
          where: { id: newAccountId },
          data: { balance: { increment: newEffect } },
        });
      }

      const updated = await tx.transaction.update({
        where: { id: current.id },
        data: {
          ...(patch.amount ? { amount: newAmount } : {}),
          ...(patch.categoryId ? { categoryId: patch.categoryId } : {}),
          ...(patch.accountId ? { accountId: patch.accountId } : {}),
          ...(patch.description ? { description: patch.description } : {}),
        },
        include: { category: true, account: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "transaction.edit",
          entity: "Transaction",
          entityId: current.id,
          before: { amount: current.amount.toString(), categoryId: current.categoryId },
          after: { amount: updated.amount.toString(), categoryId: updated.categoryId },
        },
      });
      return updated;
    });
  }

  /** Soft delete + reverse the balance effect. */
  async softDelete(userId: string, txnId: string): Promise<TxnWithRelations> {
    const txn = await this.prisma.transaction.findFirst({
      where: { id: txnId, userId, deletedAt: null },
      include: { category: true, account: true },
    });
    if (!txn) throw new NotFoundError("รายการ");
    return this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: txn.accountId },
        data: { balance: { decrement: balanceEffect(txn.type, txn.amount) } },
      });
      const deleted = await tx.transaction.update({
        where: { id: txn.id },
        data: { deletedAt: new Date() },
        include: { category: true, account: true },
      });
      await tx.auditLog.create({
        data: { userId, action: "transaction.delete", entity: "Transaction", entityId: txn.id },
      });
      return deleted;
    });
  }

  /** Preview for the clear confirmation: how many active txns in the range, summed. */
  async sumInRange(
    userId: string,
    fromLocal: string,
    toLocal: string,
    tz: string,
  ): Promise<{ count: number; total: Prisma.Decimal }> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      deletedAt: null,
      occurredAt: {
        gte: dayjs.tz(fromLocal, tz).startOf("day").toDate(),
        lte: dayjs.tz(toLocal, tz).endOf("day").toDate(),
      },
    };
    const [count, agg] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.aggregate({ where, _sum: { amount: true } }),
    ]);
    return { count, total: agg._sum.amount ?? new Prisma.Decimal(0) };
  }

  /** Bulk soft delete of a whole period; balances reversed per account, atomic. */
  async softDeleteRange(
    userId: string,
    fromLocal: string,
    toLocal: string,
    tz: string,
  ): Promise<{ count: number; total: Prisma.Decimal }> {
    return this.prisma.$transaction(async (tx) => {
      const txns = await tx.transaction.findMany({
        where: {
          userId,
          deletedAt: null,
          occurredAt: {
            gte: dayjs.tz(fromLocal, tz).startOf("day").toDate(),
            lte: dayjs.tz(toLocal, tz).endOf("day").toDate(),
          },
        },
      });
      const zero = new Prisma.Decimal(0);
      if (txns.length === 0) return { count: 0, total: zero };

      const perAccount = new Map<string, Prisma.Decimal>();
      for (const t of txns) {
        const eff = balanceEffect(t.type, t.amount);
        perAccount.set(t.accountId, (perAccount.get(t.accountId) ?? zero).plus(eff));
      }
      for (const [accountId, eff] of perAccount) {
        await tx.account.update({ where: { id: accountId }, data: { balance: { decrement: eff } } });
      }
      await tx.transaction.updateMany({
        where: { id: { in: txns.map((t) => t.id) } },
        data: { deletedAt: new Date() },
      });
      const total = txns.reduce((s, t) => s.plus(t.amount), zero);
      await tx.auditLog.create({
        data: {
          userId,
          action: "transaction.clear_range",
          entity: "Transaction",
          entityId: `${fromLocal}..${toLocal}`,
          after: { count: txns.length, total: total.toString() },
        },
      });
      return { count: txns.length, total };
    });
  }

  async restore(userId: string, ref: TxnRef): Promise<TxnWithRelations> {
    const txn = await this.prisma.transaction.findFirst({
      where: {
        userId,
        deletedAt: { not: null },
        ...(ref.by === "shortRef" ? { shortRef: ref.shortRef } : {}),
      },
      orderBy: { deletedAt: "desc" },
      include: { category: true, account: true },
    });
    if (!txn) throw new NotFoundError("รายการที่ถูกลบ");
    return this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: txn.accountId },
        data: { balance: { increment: balanceEffect(txn.type, txn.amount) } },
      });
      const restored = await tx.transaction.update({
        where: { id: txn.id },
        data: { deletedAt: null },
        include: { category: true, account: true },
      });
      await tx.auditLog.create({
        data: { userId, action: "transaction.restore", entity: "Transaction", entityId: txn.id },
      });
      return restored;
    });
  }

  /** Chat search: "กาแฟเดือนนี้" → text/category/date filters. */
  async search(
    userId: string,
    query: SearchIntent["query"],
    categoryId: string | undefined,
    tz: string,
  ): Promise<{ items: TxnWithRelations[]; total: Prisma.Decimal }> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      deletedAt: null,
      ...(categoryId ? { categoryId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: dayjs.tz(query.from, tz).startOf("day").toDate() } : {}),
              ...(query.to ? { lte: dayjs.tz(query.to, tz).endOf("day").toDate() } : {}),
            },
          }
        : {}),
      ...(query.text && !categoryId
        ? {
            OR: [
              { description: { contains: query.text, mode: "insensitive" } },
              { merchant: { contains: query.text, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const items = await this.prisma.transaction.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: 10,
      include: { category: true, account: true },
    });
    const agg = await this.prisma.transaction.aggregate({ where, _sum: { amount: true } });
    return { items, total: agg._sum.amount ?? new Prisma.Decimal(0) };
  }

  toView(txn: TxnWithRelations, tz: string): TxnView {
    return {
      id: txn.id,
      shortRef: txn.shortRef,
      type: txn.type,
      amount: formatAmount(txn.amount),
      currency: txn.currency,
      description: txn.description ?? "",
      categoryName: txn.category?.nameTh ?? "อื่นๆ",
      categoryIcon: txn.category?.icon ?? "📦",
      accountName: txn.account.name,
      occurredAt: dayjs(txn.occurredAt).tz(tz).format("D MMM"),
      ...(txn.actorName ? { actorName: txn.actorName } : {}),
    };
  }
}
