/**
 * Amount extraction from Thai chat text. Pure string math — no floats ever
 * touch a money value (see docs/00-MASTER-PLAN.md, "Correctness of money").
 *
 * Handles: "80", "1,200", "1200.50", "80บาท", "75 ฿", "1.2k", "3พัน", "2หมื่น", "1ล้าน"
 */

export interface AmountMatch {
  /** decimal string, e.g. "1200.50" */
  amount: string;
  /** exact substring matched, so the caller can strip it from the text */
  matchedText: string;
  index: number;
}

const MULTIPLIERS: Record<string, number> = {
  k: 3,
  K: 3,
  พัน: 3,
  หมื่น: 4,
  แสน: 5,
  ล้าน: 6,
};

const AMOUNT_RE =
  /(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?\s*(k|K|พัน|หมื่น|แสน|ล้าน)?\s*(บาท|baht|bath|฿)?/gu;

/** Shift the decimal point right by `zeros` using string math (no float rounding). */
export function scaleDecimal(numStr: string, zeros: number): string {
  const [intRaw = "0", fracRaw = ""] = numStr.split(".");
  const digits = intRaw + fracRaw;
  const pointPos = intRaw.length + zeros;
  const padded = digits.padEnd(pointPos, "0");
  const intPart = padded.slice(0, pointPos).replace(/^0+(?=\d)/, "");
  const fracPart = padded.slice(pointPos).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

/** Numbers followed by a counter/unit word are quantities, not baht ("ซื้อ 2 ชิ้น"). */
const COUNTER_AFTER_RE =
  /^\s*(ชิ้น|อัน|แก้ว|จาน|ขวด|กล่อง|ตัว|ครั้ง|คน|ที่นั่ง|โล|กิโล|กรัม|ลิตร|ลูก|ใบ|เม็ด|ซอง|แพ็ค|%)/u;

/**
 * All plausible amounts in the text, in order. Callers must strip date phrases
 * first so "15 ก.ค." doesn't read as 15 baht.
 */
export function extractAllAmounts(text: string): AmountMatch[] {
  const out: AmountMatch[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const [full, intPart, fracPart = "", mult, unit] = m;
    if (!intPart) continue;
    // bare fragment inside a word (e.g. "NVDA5") — require a boundary before the digits
    const prev = m.index > 0 ? text[m.index - 1] : " ";
    if (prev && /[A-Za-z0-9#]/.test(prev)) continue;

    // trim the trailing unit-less whitespace the regex may have swallowed
    const matchedText = unit || mult ? full.trimEnd() : intPart + fracPart;

    // quantity, not money: "2 ชิ้น" (unless an explicit baht unit was present)
    if (!unit && COUNTER_AFTER_RE.test(text.slice(m.index + matchedText.length))) continue;

    let amount = intPart.replace(/,/g, "") + fracPart;
    if (mult) amount = scaleDecimal(amount, MULTIPLIERS[mult] ?? 0);
    if (/^0+(\.0*)?$/.test(amount)) continue; // zero is never a real amount

    out.push({ amount, matchedText, index: m.index });
  }
  return out;
}

/**
 * The LAST plausible amount (Thai phrasing puts the amount at the end:
 * "กินข้าว 80").
 */
export function extractAmount(text: string): AmountMatch | null {
  const all = extractAllAmounts(text);
  return all.length > 0 ? (all[all.length - 1] ?? null) : null;
}
