import type { PrismaClient } from "@prisma/client";
import { SYSTEM_CATEGORIES } from "@finance-butler/shared";
import { logger } from "../utils/logger.js";

/**
 * Idempotent boot-time seeding — free hosts (Render) have no separate seed
 * step, so the server ensures system categories exist on every start.
 */
export async function seedSystemCategories(prisma: PrismaClient): Promise<void> {
  for (const c of SYSTEM_CATEGORIES) {
    const existing = await prisma.category.findFirst({ where: { userId: null, key: c.key } });
    if (!existing) {
      await prisma.category.create({
        data: {
          key: c.key,
          name: c.name,
          nameTh: c.nameTh,
          icon: c.icon,
          kind: c.kind,
          isSystem: true,
        },
      });
    }
  }
  logger.info("system categories ready");
}
