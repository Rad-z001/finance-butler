import { describe, expect, it } from "vitest";
import { resolveDate, resolvePeriod } from "../../nlp/date-resolver.js";

const TZ = "Asia/Bangkok";
// fixed "now": 2026-07-20 10:00 Bangkok (a Monday) = 03:00 UTC
const NOW = new Date("2026-07-20T03:00:00Z");

describe("resolveDate", () => {
  const cases: Array<[string, string]> = [
    ["วันนี้กินข้าว", "2026-07-20"],
    ["เมื่อวานกินข้าว 70", "2026-07-19"],
    ["เมื่อวานซืน", "2026-07-18"],
    ["พรุ่งนี้จ่ายค่าเช่า", "2026-07-21"],
    ["ซื้อกาแฟเมื่อเช้า 65", "2026-07-20"],
    ["15 ก.ค. ค่าไฟ 900", "2026-07-15"],
    ["ค่าเน็ต 5 กรกฎาคม", "2026-07-05"],
    ["1/7 กาแฟ 65", "2026-07-01"],
    ["15/7/2569 ค่าไฟ", "2026-07-15"],
    ["วันจันทร์", "2026-07-20"], // today is Monday → today
    ["วันศุกร์", "2026-07-17"], // most recent past Friday
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" → ${expected}`, () => {
      expect(resolveDate(input, TZ, NOW)?.date).toBe(expected);
    });
  }

  it("returns null when there is no date", () => {
    expect(resolveDate("กินข้าว 80", TZ, NOW)).toBeNull();
  });
});

describe("resolvePeriod", () => {
  it("เดือนนี้ → month anchored on today", () => {
    const p = resolvePeriod("กาแฟเดือนนี้", TZ, NOW);
    expect(p?.period).toBe("month");
    expect(p?.anchor).toBe("2026-07-20");
  });
  it("เดือนที่แล้ว → previous month", () => {
    expect(resolvePeriod("เดือนที่แล้ว", TZ, NOW)?.anchor).toBe("2026-06-20");
  });
  it("เดือนก่อน → previous month", () => {
    expect(resolvePeriod("ค่าอาหารเดือนก่อน", TZ, NOW)?.period).toBe("month");
  });
  it("ปีนี้ → year", () => {
    expect(resolvePeriod("ค่าอาหารปีนี้", TZ, NOW)?.period).toBe("year");
  });
});
