import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Resolves Thai (and basic English) date phrases to an absolute date in the
 * user's timezone. Returns the matched substring so the parser can strip it
 * before amount extraction ("15 ก.ค. ค่าไฟ 900" must not read 15 as baht).
 */

export interface DateMatch {
  /** local date, YYYY-MM-DD */
  date: string;
  matchedText: string;
}

export interface PeriodMatch {
  period: "day" | "week" | "month" | "year";
  /** anchor date YYYY-MM-DD (e.g. last month → 15th of that month) */
  anchor: string;
  matchedText: string;
}

const THAI_MONTHS: Record<string, number> = {
  "ม.ค.": 1, "มกราคม": 1, "มกรา": 1,
  "ก.พ.": 2, "กุมภาพันธ์": 2, "กุมภา": 2,
  "มี.ค.": 3, "มีนาคม": 3, "มีนา": 3,
  "เม.ย.": 4, "เมษายน": 4, "เมษา": 4,
  "พ.ค.": 5, "พฤษภาคม": 5, "พฤษภา": 5,
  "มิ.ย.": 6, "มิถุนายน": 6, "มิถุนา": 6,
  "ก.ค.": 7, "กรกฎาคม": 7, "กรกฎา": 7,
  "ส.ค.": 8, "สิงหาคม": 8, "สิงหา": 8,
  "ก.ย.": 9, "กันยายน": 9, "กันยา": 9,
  "ต.ค.": 10, "ตุลาคม": 10, "ตุลา": 10,
  "พ.ย.": 11, "พฤศจิกายน": 11, "พฤศจิกา": 11,
  "ธ.ค.": 12, "ธันวาคม": 12, "ธันวา": 12,
};

const WEEKDAYS: Record<string, number> = {
  อาทิตย์: 0, จันทร์: 1, อังคาร: 2, พุธ: 3, พฤหัสบดี: 4, พฤหัส: 4, ศุกร์: 5, เสาร์: 6,
};

function fmt(d: Dayjs): string {
  return d.format("YYYY-MM-DD");
}

/** Buddhist-era years (25xx) → CE. */
function normalizeYear(y: number, now: Dayjs): number {
  if (y > 2400) return y - 543;
  if (y < 100) return Math.floor(now.year() / 100) * 100 + y;
  return y;
}

export function resolveDate(text: string, tz: string, nowUtc?: Date): DateMatch | null {
  const now = nowUtc ? dayjs(nowUtc).tz(tz) : dayjs().tz(tz);

  // relative words — most specific first
  const relative: Array<[RegExp, () => Dayjs]> = [
    [/เมื่อวานซืน/u, () => now.subtract(2, "day")],
    [/เมื่อวาน(นี้)?|yesterday/iu, () => now.subtract(1, "day")],
    [/เมื่อคืน/u, () => now.subtract(1, "day")],
    [/เมื่อเช้า|เมื่อบ่าย|เมื่อกี้|today|วันนี้/iu, () => now],
    [/พรุ่งนี้|tomorrow/iu, () => now.add(1, "day")],
  ];
  for (const [re, resolve] of relative) {
    const m = text.match(re);
    if (m?.[0] !== undefined && m.index !== undefined) {
      return { date: fmt(resolve()), matchedText: m[0] };
    }
  }

  // วันจันทร์ / จันทร์ที่แล้ว → most recent past occurrence (today counts)
  const wd = text.match(/วัน(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์)(ที่แล้ว|ก่อน)?/u);
  if (wd?.[1]) {
    const target = WEEKDAYS[wd[1]];
    if (target !== undefined) {
      let diff = (now.day() - target + 7) % 7;
      if (wd[2] && diff === 0) diff = 7; // "จันทร์ที่แล้ว" said on a Monday
      return { date: fmt(now.subtract(diff, "day")), matchedText: wd[0] };
    }
  }

  // "15 ก.ค." / "15 ก.ค. 2569" / "15 กรกฎาคม"
  const monthAlt = Object.keys(THAI_MONTHS)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/\./g, "\\."))
    .join("|");
  const thaiDate = text.match(new RegExp(`(\\d{1,2})\\s*(${monthAlt})\\s*(\\d{2,4})?`, "u"));
  if (thaiDate?.[1] && thaiDate[2]) {
    const day = Number(thaiDate[1]);
    const month = THAI_MONTHS[thaiDate[2]];
    if (month && day >= 1 && day <= 31) {
      const year = thaiDate[3] ? normalizeYear(Number(thaiDate[3]), now) : now.year();
      const d = now.year(year).month(month - 1).date(day);
      return { date: fmt(d), matchedText: thaiDate[0] };
    }
  }

  // "1/7" or "1/7/2569" — Thai convention: day/month(/year)
  const slash = text.match(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/])/u);
  if (slash?.[1] && slash[2]) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const year = slash[3] ? normalizeYear(Number(slash[3]), now) : now.year();
      const d = now.year(year).month(month - 1).date(day);
      return { date: fmt(d), matchedText: slash[0] };
    }
  }

  return null;
}

/** Period phrases for search/stats: เดือนนี้, เดือนที่แล้ว, ปีนี้, สัปดาห์นี้, last month … */
export function resolvePeriod(text: string, tz: string, nowUtc?: Date): PeriodMatch | null {
  const now = nowUtc ? dayjs(nowUtc).tz(tz) : dayjs().tz(tz);
  const table: Array<[RegExp, PeriodMatch["period"], () => Dayjs]> = [
    [/วันนี้|today/iu, "day", () => now],
    [/สัปดาห์นี้|อาทิตย์นี้|this week/iu, "week", () => now],
    [/สัปดาห์(ที่แล้ว|ก่อน)|last week/iu, "week", () => now.subtract(1, "week")],
    [/เดือนนี้|this month/iu, "month", () => now],
    [/เดือน(ที่แล้ว|ก่อน)|last month/iu, "month", () => now.subtract(1, "month")],
    [/เดือนหน้า|next month/iu, "month", () => now.add(1, "month")],
    [/ปีนี้|this year/iu, "year", () => now],
    [/ปี(ที่แล้ว|ก่อน)|last year/iu, "year", () => now.subtract(1, "year")],
  ];
  for (const [re, period, anchor] of table) {
    const m = text.match(re);
    if (m?.[0] !== undefined) return { period, anchor: fmt(anchor()), matchedText: m[0] };
  }
  return null;
}
