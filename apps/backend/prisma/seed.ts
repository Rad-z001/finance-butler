import { PrismaClient } from "@prisma/client";
import { SYSTEM_CATEGORIES } from "@finance-butler/shared";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const c of SYSTEM_CATEGORIES) {
    await prisma.category.upsert({
      where: { userId_name: { userId: null as unknown as string, name: c.name } },
      update: { nameTh: c.nameTh, icon: c.icon, kind: c.kind, key: c.key },
      create: {
        key: c.key,
        name: c.name,
        nameTh: c.nameTh,
        icon: c.icon,
        kind: c.kind,
        isSystem: true,
      },
    }).catch(async () => {
      // upsert on nullable unique needs a fallback: find-or-create
      const existing = await prisma.category.findFirst({
        where: { userId: null, key: c.key },
      });
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
    });
  }
  console.log(`Seeded ${SYSTEM_CATEGORIES.length} system categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
