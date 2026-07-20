/**
 * Validates every CoreMessageBuilder card against LINE's real validation API
 * (POST /v2/bot/message/validate/push — checks structure without sending).
 * Usage: npx tsx scripts/validate-flex.mts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CoreMessageBuilder } from "../src/line/messages/core-builder.js";
import type { StatsView, TxnView } from "@finance-butler/shared";

const envFile = readFileSync(fileURLToPath(new URL("../.env", import.meta.url)), "utf8");
const TOKEN = envFile.match(/^LINE_CHANNEL_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim();
if (!TOKEN || TOKEN.startsWith("PASTE_")) {
  console.error("no LINE token in .env");
  process.exit(1);
}

const b = new CoreMessageBuilder();
const txn: TxnView = {
  id: "t1", shortRef: 12, type: "EXPENSE", amount: "1,200", currency: "THB",
  description: "เติมน้ำมัน", categoryName: "เดินทาง", categoryIcon: "🚌",
  accountName: "เงินสด", occurredAt: "20 ก.ค.", actorName: "กันต์",
};
const stats: StatsView = {
  period: "month", anchor: "2026-07-20", prevAnchor: "2026-06-20",
  periodLabel: "เดือนนี้", income: "35,000", expense: "12,450", net: "22,550",
  totalBalance: "48,200", txnCount: 23, expenseChangePct: 12,
  topCategories: [
    { name: "อาหาร", icon: "🍚", amount: "5,200", pct: 42 },
    { name: "เดินทาง", icon: "🚌", amount: "3,100", pct: 25 },
    { name: "บันเทิง", icon: "🎬", amount: "1,800", pct: 14 },
  ],
  payerBreakdown: [
    { name: "กันต์", icon: "👤", amount: "7,000", pct: 56 },
    { name: "มายด์", icon: "👤", amount: "5,450", pct: 44 },
  ],
};

const cases: Array<[string, unknown[]]> = [
  ["welcome", b.welcome("กันต์")],
  ["welcomeGroup", b.welcomeGroup("คู่เรา")],
  ["txnSaved", b.txnSaved(txn, "4,930")],
  ["txnBatchSaved", b.txnBatchSaved([txn, { ...txn, shortRef: 13, type: "INCOME" }], "4,930")],
  ["txnList", b.txnList([txn, txn], "2,400", "กาแฟ · เดือนนี้")],
  ["statsSummary", b.statsSummary(stats)],
  ["statsSummary(empty)", b.statsSummary({ ...stats, topCategories: [], payerBreakdown: [], expenseChangePct: null })],
  ["deleteConfirm", b.deleteConfirm(txn)],
  ["categoryPicker", b.categoryPicker("t1", [{ id: "c1", key: "food", name: "Food", nameTh: "อาหาร", icon: "🍚" }])],
  ["budgetAlert", b.budgetAlert({ categoryName: "อาหาร", level: 82, spent: "4,100", limit: "5,000" })],
  ["goalProgress", b.goalProgress({ name: "ซื้อรถ", current: "120,000", target: "300,000", pct: 40 })],
  ["help", b.help()],
];

let failed = 0;
for (const [name, messages] of cases) {
  const res = await fetch("https://api.line.me/v2/bot/message/validate/push", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ messages }),
  });
  if (res.ok) {
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.error(`✗ ${name}: ${res.status} ${await res.text()}`);
  }
}
process.exit(failed ? 1 : 0);
