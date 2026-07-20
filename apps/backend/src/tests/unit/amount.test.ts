import { describe, expect, it } from "vitest";
import { extractAmount, scaleDecimal } from "../../nlp/amount.js";

describe("scaleDecimal", () => {
  it("shifts the decimal point with string math", () => {
    expect(scaleDecimal("1.2", 3)).toBe("1200");
    expect(scaleDecimal("80", 0)).toBe("80");
    expect(scaleDecimal("2", 4)).toBe("20000");
    expect(scaleDecimal("1.25", 3)).toBe("1250");
    expect(scaleDecimal("0.5", 6)).toBe("500000");
  });
});

describe("extractAmount", () => {
  const cases: Array<[string, string | null]> = [
    ["กินข้าว 80", "80"],
    ["กาแฟ Amazon 75", "75"],
    ["เติมน้ำมัน 1200", "1200"],
    ["เติมน้ำมัน 1,200", "1200"],
    ["ค่าคอนโด 12000.50", "12000.50"],
    ["ซื้อของ 1.2k", "1200"],
    ["โบนัส 3หมื่น", "30000"],
    ["ข้าว 80บาท", "80"],
    ["ข้าว 80 บาท", "80"],
    ["กาแฟ 65฿", "65"],
    ["เงินเดือน 35000", "35000"],
    ["ไม่มีตัวเลขเลย", null],
    ["0 บาท", null],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" → ${expected}`, () => {
      expect(extractAmount(input)?.amount ?? null).toBe(expected);
    });
  }

  it("takes the LAST number (amounts trail in Thai)", () => {
    expect(extractAmount("ซื้อ 2 ชิ้น 150")?.amount).toBe("150");
  });

  it("ignores digits glued to letters (#52, NVDA5)", () => {
    expect(extractAmount("ลบ #52")).toBeNull();
  });
});
