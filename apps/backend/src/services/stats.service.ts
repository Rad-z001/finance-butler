import { Prisma, type PrismaClient } from "@prisma/client";
import type { StatsView } from "@finance-butler/shared";
import dayjs from "dayjs";
import { formatAmount } from "../utils/money.js";
import { isFuturePeriod, periodRange, shiftAnchor, type PeriodKind } from "../utils/period.js";

const OUTFLOW_TYPES = ["EXPENSE", "INVESTMENT", "LOAN", "DEBT", "SAVING"] as const;

export class StatsService {
  constructor(private readonly prisma: PrismaClient) {}

  async summary(userId: string, period: PeriodKind, tz: string, anchor?: string): Promise<StatsView> {
    const anchorStr = anchor ?? dayjs().tz(tz).format("YYYY-MM-DD");
    const range = periodRange(period, tz, anchorStr);
    const prevAnchor = shiftAnchor(period, anchorStr, tz, -1);
    const prevRange = periodRange(period, tz, prevAnchor);
    const nextAnchor = shiftAnchor(period, anchorStr, tz, 1);

    const base: Prisma.TransactionWhereInput = {
      userId,
      deletedAt: null,
      occurredAt: { gte: range.from, lte: range.to },
    };

    const [income, expense, prevExpense, count, byCategory, byPayer, accounts] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...base, type: "INCOME" },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...base, type: { in: [...OUTFLOW_TYPES] } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          userId,
          deletedAt: null,
          occurredAt: { gte: prevRange.from, lte: prevRange.to },
          type: { in: [...OUTFLOW_TYPES] },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.count({ where: base }),
      this.prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { ...base, type: "EXPENSE" },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),
      // group-ledger mode: outflow per member (actorName null on personal ledgers)
      this.prisma.transaction.groupBy({
        by: ["actorName"],
        where: { ...base, type: { in: [...OUTFLOW_TYPES] }, actorName: { not: null } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 6,
      }),
      this.prisma.account.aggregate({
        where: { userId, isArchived: false, type: { not: "CREDIT_CARD" } },
        _sum: { balance: true },
      }),
    ]);

    const zero = new Prisma.Decimal(0);
    const inc = income._sum.amount ?? zero;
    const exp = expense._sum.amount ?? zero;
    const prevExp = prevExpense._sum.amount ?? zero;
    const expenseTotal = exp.isZero() ? new Prisma.Decimal(1) : exp;

    const catIds = byCategory.map((c) => c.categoryId).filter((id): id is string => id !== null);
    const cats = await this.prisma.category.findMany({ where: { id: { in: catIds } } });
    const catMap = new Map(cats.map((c) => [c.id, c]));

    return {
      period,
      anchor: anchorStr,
      prevAnchor,
      ...(isFuturePeriod(period, nextAnchor, tz) ? {} : { nextAnchor }),
      periodLabel: range.label,
      income: formatAmount(inc),
      expense: formatAmount(exp),
      net: formatAmount(inc.minus(exp)),
      totalBalance: formatAmount(accounts._sum.balance ?? zero),
      txnCount: count,
      expenseChangePct: prevExp.isZero()
        ? null
        : Math.round(exp.minus(prevExp).div(prevExp).mul(100).toNumber()),
      topCategories: byCategory.map((row) => {
        const cat = row.categoryId ? catMap.get(row.categoryId) : undefined;
        const amt = row._sum.amount ?? zero;
        return {
          name: cat?.nameTh ?? "อื่นๆ",
          icon: cat?.icon ?? "📦",
          amount: formatAmount(amt),
          pct: Math.round(amt.div(expenseTotal).mul(100).toNumber()),
        };
      }),
      payerBreakdown: byPayer.map((row) => {
        const amt = row._sum.amount ?? zero;
        return {
          name: row.actorName ?? "ไม่ระบุ",
          icon: "👤",
          amount: formatAmount(amt),
          pct: Math.round(amt.div(expenseTotal).mul(100).toNumber()),
        };
      }),
    };
  }
}
