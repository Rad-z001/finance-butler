import { PrismaClient } from "@prisma/client";
import { StatsService } from "../src/services/stats.service.js";
const p = new PrismaClient();
const ledger = await p.user.findUnique({ where: { lineUserId: "C_couple_test" } });
if (!ledger) { console.log("NO GROUP LEDGER CREATED — bug in ledger resolution"); process.exit(1); }
console.log(`ledger: ${ledger.displayName} (isGroup=${ledger.isGroup})`);
const txns = await p.transaction.findMany({ where: { userId: ledger.id }, include: { category: true } });
for (const t of txns) console.log(`  ${t.description} ${t.amount}฿ actor=${t.actorName ?? "NULL"} (${t.actorLineUserId ?? "-"})`);
const stats = await new StatsService(p).summary(ledger.id, "day", "Asia/Bangkok");
console.log("summary:", JSON.stringify({ income: stats.income, expense: stats.expense, txnCount: stats.txnCount, payers: stats.payerBreakdown }));
await p.$disconnect();
