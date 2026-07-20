import type { Category, PrismaClient } from "@prisma/client";
import { suggestCategoryKey } from "../nlp/category-keywords.js";

/** Normalized lookup key for corrections: lowercase, collapsed whitespace. */
export function normalizeKeyword(text: string): string {
  return text.toLowerCase().replace(/\s+/gu, " ").trim().slice(0, 120);
}

export class CategoryService {
  constructor(private readonly prisma: PrismaClient) {}

  /** System + user categories visible to this user. */
  list(userId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }

  bySystemKey(key: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { userId: null, key } });
  }

  /** Match a free-text hint ("อาหาร", "food", "กาแฟ") to a category. */
  async byHint(userId: string, hint: string): Promise<Category | null> {
    const h = normalizeKeyword(hint);
    const direct = await this.prisma.category.findFirst({
      where: {
        OR: [{ userId: null }, { userId }],
        AND: {
          OR: [
            { nameTh: { contains: h } },
            { name: { contains: h, mode: "insensitive" } },
            { key: h },
          ],
        },
      },
    });
    if (direct) return direct;
    const key = suggestCategoryKey(h);
    return key ? this.bySystemKey(key) : null;
  }

  /**
   * Resolution order for a new transaction (docs/00-MASTER-PLAN.md D2):
   * 1. the user's own past corrections (exact normalized description/merchant)
   * 2. parser keyword hint  3. Others.
   */
  async resolveForTransaction(
    userId: string,
    description: string,
    merchant: string | undefined,
    hintKey: string | undefined,
  ): Promise<Category> {
    for (const kw of [normalizeKeyword(description), merchant && normalizeKeyword(merchant)]) {
      if (!kw) continue;
      const corr = await this.prisma.categoryCorrection.findUnique({
        where: { userId_keyword: { userId, keyword: kw } },
        include: { category: true },
      });
      if (corr) {
        await this.prisma.categoryCorrection.update({
          where: { id: corr.id },
          data: { hitCount: { increment: 1 }, lastUsedAt: new Date() },
        });
        return corr.category;
      }
    }
    if (hintKey) {
      const hinted = await this.bySystemKey(hintKey);
      if (hinted) return hinted;
    }
    const others = await this.bySystemKey("others");
    if (!others) throw new Error("system categories not seeded — run npm run db:seed");
    return others;
  }

  /** "Remember corrections forever": user reassigned a category → learn the mapping. */
  async learnCorrection(userId: string, keyword: string, categoryId: string): Promise<void> {
    const kw = normalizeKeyword(keyword);
    if (!kw) return;
    await this.prisma.categoryCorrection.upsert({
      where: { userId_keyword: { userId, keyword: kw } },
      update: { categoryId, hitCount: { increment: 1 }, lastUsedAt: new Date() },
      create: { userId, keyword: kw, categoryId },
    });
  }
}
