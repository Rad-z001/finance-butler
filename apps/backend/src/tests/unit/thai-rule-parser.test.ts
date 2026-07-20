import { describe, expect, it } from "vitest";
import { ThaiRuleParser } from "../../nlp/thai-rule-parser.js";
import type { AddTransactionIntent } from "@finance-butler/shared";

const TZ = "Asia/Bangkok";
const NOW = new Date("2026-07-20T03:00:00Z"); // 2026-07-20 10:00 Bangkok, Monday
const parser = new ThaiRuleParser();

function parseTxn(text: string): AddTransactionIntent {
  const intent = parser.parse(text, TZ, NOW);
  expect(intent.kind).toBe("add_transaction");
  return intent as AddTransactionIntent;
}

describe("spec examples → add_transaction", () => {
  it("กินข้าว 80", () => {
    const t = parseTxn("กินข้าว 80");
    expect(t.amount).toBe("80");
    expect(t.type).toBe("EXPENSE");
    expect(t.categoryHint).toBe("food");
    expect(t.occurredAt).toBe("2026-07-20");
  });

  it("กาแฟ Amazon 75", () => {
    const t = parseTxn("กาแฟ Amazon 75");
    expect(t.amount).toBe("75");
    expect(t.categoryHint).toBe("food");
    expect(t.merchant).toBe("Amazon");
  });

  it("เติมน้ำมัน 1200", () => {
    const t = parseTxn("เติมน้ำมัน 1200");
    expect(t.amount).toBe("1200");
    expect(t.categoryHint).toBe("transport");
  });

  it("ซื้อหุ้น NVDA 5000", () => {
    const t = parseTxn("ซื้อหุ้น NVDA 5000");
    expect(t.amount).toBe("5000");
    expect(t.type).toBe("INVESTMENT");
    expect(t.merchant).toBe("NVDA");
  });

  it("เงินเดือน 35000", () => {
    const t = parseTxn("เงินเดือน 35000");
    expect(t.type).toBe("INCOME");
    expect(t.categoryHint).toBe("salary");
  });

  it("โบนัส 5000 / ขายของ 1200 are income", () => {
    expect(parseTxn("โบนัส 5000").type).toBe("INCOME");
    expect(parseTxn("ขายของ 1200").type).toBe("INCOME");
  });

  it("เมื่อวานกินข้าว 70 → dated yesterday", () => {
    const t = parseTxn("เมื่อวานกินข้าว 70");
    expect(t.amount).toBe("70");
    expect(t.occurredAt).toBe("2026-07-19");
  });

  it("ซื้อกาแฟเมื่อเช้า 65 → today", () => {
    expect(parseTxn("ซื้อกาแฟเมื่อเช้า 65").occurredAt).toBe("2026-07-20");
  });

  it("15 ก.ค. ค่าไฟ 900 → July 15, bills, amount 900 (not 15)", () => {
    const t = parseTxn("15 ก.ค. ค่าไฟ 900");
    expect(t.amount).toBe("900");
    expect(t.occurredAt).toBe("2026-07-15");
    expect(t.categoryHint).toBe("bills");
  });

  it("1/7 กาแฟ 65 → July 1", () => {
    const t = parseTxn("1/7 กาแฟ 65");
    expect(t.amount).toBe("65");
    expect(t.occurredAt).toBe("2026-07-01");
  });
});

describe("commands", () => {
  it("สรุปวันนี้ / เดือนนี้ → stats", () => {
    expect(parser.parse("สรุปวันนี้", TZ, NOW)).toMatchObject({ kind: "stats", period: "day" });
    expect(parser.parse("สรุปเดือนนี้", TZ, NOW)).toMatchObject({ kind: "stats", period: "month" });
    expect(parser.parse("เดือนนี้", TZ, NOW)).toMatchObject({ kind: "stats", period: "month" });
    expect(parser.parse("ปีนี้", TZ, NOW)).toMatchObject({ kind: "stats", period: "year" });
  });

  it("ลบรายการล่าสุด / ลบ #52 → delete", () => {
    expect(parser.parse("ลบรายการล่าสุด", TZ, NOW)).toMatchObject({
      kind: "delete",
      ref: { by: "last" },
    });
    expect(parser.parse("ลบ #52", TZ, NOW)).toMatchObject({
      kind: "delete",
      ref: { by: "shortRef", shortRef: 52 },
    });
  });

  it("แก้รายการล่าสุดเป็น 150 → edit amount", () => {
    expect(parser.parse("แก้รายการล่าสุดเป็น 150", TZ, NOW)).toMatchObject({
      kind: "edit",
      ref: { by: "last" },
      patch: { amount: "150" },
    });
  });

  it("เปลี่ยนหมวดเป็นอาหาร → edit category", () => {
    expect(parser.parse("เปลี่ยนหมวดเป็นอาหาร", TZ, NOW)).toMatchObject({
      kind: "edit",
      patch: { categoryHint: "อาหาร" },
    });
  });

  it("เปลี่ยนบัญชีเป็น SCB → edit account", () => {
    expect(parser.parse("เปลี่ยนบัญชีเป็น SCB", TZ, NOW)).toMatchObject({
      kind: "edit",
      patch: { accountHint: "SCB" },
    });
  });

  it("กู้คืน #52 → restore", () => {
    expect(parser.parse("กู้คืน #52", TZ, NOW)).toMatchObject({
      kind: "restore",
      ref: { by: "shortRef", shortRef: 52 },
    });
  });
});

describe("search", () => {
  it("กาแฟเดือนนี้ → search with month range", () => {
    const s = parser.parse("กาแฟเดือนนี้", TZ, NOW);
    expect(s).toMatchObject({ kind: "search" });
    if (s.kind === "search") {
      expect(s.query.text).toBe("กาแฟ");
      expect(s.query.from).toBe("2026-07-01");
      expect(s.query.to).toBe("2026-07-31");
    }
  });

  it("ค่าอาหารปีนี้ → search food this year", () => {
    const s = parser.parse("ค่าอาหารปีนี้", TZ, NOW);
    if (s.kind === "search") {
      expect(s.query.categoryHint).toBe("food");
      expect(s.query.from).toBe("2026-01-01");
    } else {
      expect.fail("expected search");
    }
  });

  it("ค้นหาร้าน Amazon → explicit search", () => {
    const s = parser.parse("ค้นหาร้าน Amazon", TZ, NOW);
    if (s.kind === "search") expect(s.query.text).toBe("Amazon");
    else expect.fail("expected search");
  });
});

describe("fallback", () => {
  it("junk → unknown (goes to Claude)", () => {
    expect(parser.parse("สวัสดีครับ", TZ, NOW).kind).toBe("unknown");
    expect(parser.parse("ควรออมเงินยังไงดี", TZ, NOW).kind).toBe("unknown");
  });

  it("bare number → unknown, never a guessed transaction", () => {
    expect(parser.parse("500", TZ, NOW).kind).toBe("unknown");
  });
});
