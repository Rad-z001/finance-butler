import type { SystemCategoryKey } from "@finance-butler/shared";

/**
 * Keyword → system category hints for the rule parser. Order matters:
 * earlier entries win (investment's "ซื้อหุ้น" must beat shopping's "ซื้อ").
 * The user's own CategoryCorrection rows always override this map.
 */
const KEYWORD_MAP: Array<[RegExp, SystemCategoryKey]> = [
  // investment — before generic ซื้อ/ขาย
  [/หุ้น|กองทุน|etf|crypto|คริปโต|บิทคอยน์|bitcoin|btc|eth|ทองคำ|ซื้อทอง/iu, "investment"],
  // income-ish
  [/เงินเดือน/u, "salary"],
  [/โบนัส|ปันผล|ดอกเบี้ย/u, "salary"],
  [/ขายของ|ขายได้|รายได้เสริม/u, "business"],
  // expenses
  [/ประกัน/u, "insurance"],
  [/ภาษี/u, "tax"],
  [/ของขวัญ|ซองงาน|ทำบุญ|บริจาค/u, "gift"],
  [/ค่าไฟ|ค่าน้ำ(?!มัน)|ค่าเน็ต|อินเทอร์เน็ต|ค่าโทรศัพท์|ค่ามือถือ|ค่าเช่า|ค่าส่วนกลาง|บิล/u, "bills"],
  [/น้ำมัน|แท็กซี่|taxi|grab|แกร็บ|วินมอ|รถเมล์|รถไฟ|bts|mrt|ทางด่วน|ค่ารถ|ค่าเดินทาง|จอดรถ|เดินทาง/iu, "transport"],
  [/หมอ|ยา(?![กมนวย])|โรงพยาบาล|คลินิก|ฟิตเนส|หาหมอ|ตรวจสุขภาพ|ทำฟัน/u, "health"],
  [/หนังสือ|คอร์ส|ค่าเทอม|ติว|เรียน/u, "education"],
  [/โรงแรม|ตั๋วเครื่องบิน|ทริป|ที่พัก|เที่ยว/u, "travel"],
  [/หนัง(?!สือ)|เกม|คอนเสิร์ต|netflix|spotify|youtube|บันเทิง/iu, "entertainment"],
  [/กิน|ข้าว|อาหาร|กาแฟ|ชานม|เครื่องดื่ม|ก๋วยเตี๋ยว|ขนม|บุฟเฟ่|หมูกระทะ|ชาบู|ปิ้งย่าง|มื้อ|เบเกอรี่|น้ำ(?!มัน)/u, "food"],
  [/เสื้อ|กางเกง|รองเท้า|กระเป๋า|shopee|lazada|ช้อป|เครื่องสำอาง|สกินแคร์/iu, "shopping"],
];

export function suggestCategoryKey(text: string): SystemCategoryKey | undefined {
  for (const [re, key] of KEYWORD_MAP) {
    if (re.test(text)) return key;
  }
  return undefined;
}

/** Income detection — separate from category, drives TransactionType. */
const INCOME_RE =
  /เงินเดือน|โบนัส|ขายของ|ขายได้|รายรับ|รายได้|ได้เงิน|รับเงิน|เงินเข้า|ปันผล|ดอกเบี้ย|คืนเงิน|ถูกหวย/u;
const INVESTMENT_RE = /(ซื้อ|ขาย)\s*(หุ้น|กองทุน|ทอง|crypto|คริปโต|บิทคอยน์|btc|eth)|dca/iu;

export function suggestType(text: string): "INCOME" | "EXPENSE" | "INVESTMENT" {
  if (INVESTMENT_RE.test(text)) return "INVESTMENT";
  if (INCOME_RE.test(text)) return "INCOME";
  return "EXPENSE";
}
