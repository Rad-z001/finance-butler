/**
 * Dev smoke-check: prints what the E2E webhook test wrote to the database.
 * Usage: npx tsx scripts/verify-e2e.mts [lineUserId]
 */
import { PrismaClient } from "@prisma/client";

const lineUserId = process.argv[2] ?? "U_e2e_test_kazelle";
const p = new PrismaClient();

const user = await p.user.findFirst({ where: { lineUserId }, include: { accounts: true } });
if (!user) {
  console.error(`no user with lineUserId=${lineUserId}`);
  process.exit(1);
}
console.log(
  `USER: ${user.displayName} | tz: ${user.timezone} | account: ${user.accounts[0]?.name} | balance: ${user.accounts[0]?.balance}`,
);

const txns = await p.transaction.findMany({
  where: { userId: user.id },
  include: { category: true },
  orderBy: { shortRef: "asc" },
});
for (const t of txns) {
  console.log(
    `TXN #${t.shortRef}: ${t.type} ${t.amount}฿ | "${t.description}" | cat: ${t.category?.nameTh} | ` +
      `merchant: ${t.merchant ?? "-"} | date: ${t.occurredAt.toISOString().slice(0, 10)} | src: ${t.source}`,
  );
}

console.log(
  `aiConversation: ${await p.aIConversation.count({ where: { userId: user.id } })} | ` +
    `auditLog: ${await p.auditLog.count({ where: { userId: user.id } })} | ` +
    `webhookEvents: ${await p.webhookEvent.count()}`,
);
await p.$disconnect();
