import { Prisma, type PrismaClient } from "@prisma/client";
import type { StatsView } from "@finance-butler/shared";
import { formatAmount } from "../utils/money.js";
import { periodRange, type PeriodKind } from "../utils/period.js";

export class StatsService {
  constructor(private readonly prisma: PrismaClient) {}

  async summary(userId: string, period: PeriodKind, tz: string, anchor?: string): Promise<StatsView> {
    const range = periodRange(period, tz, anchor);
    const base: Prisma.TransactionWhereInput = {
      userId,
      deletedAt: null,
      occurredAt: { gte: range.from, lte: range.to },
    };

    const [income, expense, count, byCategory, accounts] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...base, type: "INCOME" },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...base, type: { in: ["EXPENSE", "INVESTMENT", "LOAN", "DEBT", "SAVING"] } },
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
      this.prisma.account.aggregate({
        where: { userId, isArchived: false, type: { not: "CREDIT_CARD" } },
        _sum: { balance: true },
      }),
    ]);

    const zero = new Prisma.Decimal(0);
    const inc = income._sum.amount ?? zero;
    const exp = expense._sum.amount ?? zero;
    const expenseTotal = exp.isZero() ? new Prisma.Decimal(1) : exp;

    const catIds = byCategory.map((c) => c.categoryId).filter((id): id is string => id !== null);
    const cats = await this.prisma.category.findMany({ where: { id: { in: catIds } } });
    const catMap = new Map(cats.map((c) => [c.id, c]));

    return {
      periodLabel: range.label,
      income: formatAmount(inc),
      expense: formatAmount(exp),
      net: formatAmount(inc.minus(exp)),
      totalBalance: formatAmount(accounts._sum.balance ?? zero),
      txnCount: count,
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
    };
  }
}
