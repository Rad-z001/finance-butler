import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import "dayjs/locale/th.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("th"); // Thai month names everywhere (ก.ค., ส.ค., …)

export type PeriodKind = "day" | "week" | "month" | "quarter" | "year";

export interface DateRange {
  /** inclusive UTC instants covering the local period */
  from: Date;
  to: Date;
  label: string;
}

const CURRENT_LABELS: Record<PeriodKind, string> = {
  day: "วันนี้",
  week: "สัปดาห์นี้",
  month: "เดือนนี้",
  quarter: "ไตรมาสนี้",
  year: "ปีนี้",
};

/** Buddhist-era year, the convention Thai users read. */
const be = (d: Dayjs): number => d.year() + 543;

function label(kind: PeriodKind, start: Dayjs, end: Dayjs, isCurrent: boolean): string {
  if (isCurrent) return CURRENT_LABELS[kind];
  switch (kind) {
    case "day":
      return `${start.format("D MMM")} ${be(start)}`;
    case "week":
      return `${start.format("D MMM")} – ${end.format("D MMM")} ${be(end)}`;
    case "month":
      return `${start.format("MMM")} ${be(start)}`;
    case "quarter":
      return `ไตรมาส ${Math.floor(start.month() / 3) + 1} ปี ${be(start)}`;
    case "year":
      return `ปี ${be(start)}`;
  }
}

function bounds(kind: PeriodKind, anchor: Dayjs): { start: Dayjs; end: Dayjs } {
  if (kind === "quarter") {
    const qStartMonth = Math.floor(anchor.month() / 3) * 3;
    return {
      start: anchor.month(qStartMonth).startOf("month"),
      end: anchor.month(qStartMonth + 2).endOf("month"),
    };
  }
  return { start: anchor.startOf(kind), end: anchor.endOf(kind) };
}

/** Local-timezone period boundaries as UTC instants for DB queries. */
export function periodRange(kind: PeriodKind, tz: string, anchorDate?: string): DateRange {
  const anchor = anchorDate ? dayjs.tz(anchorDate, tz) : dayjs().tz(tz);
  const { start, end } = bounds(kind, anchor);
  const now = dayjs().tz(tz);
  const isCurrent = now.isAfter(start.subtract(1, "millisecond")) && now.isBefore(end);
  return { from: start.toDate(), to: end.toDate(), label: label(kind, start, end, isCurrent) };
}

/** Anchor of the adjacent period (dir −1 = previous, +1 = next), as local YYYY-MM-DD. */
export function shiftAnchor(kind: PeriodKind, anchor: string, tz: string, dir: 1 | -1): string {
  const d = dayjs.tz(anchor, tz);
  const shifted = kind === "quarter" ? d.add(dir * 3, "month") : d.add(dir, kind);
  return shifted.format("YYYY-MM-DD");
}

/** True when the period containing `anchor` starts after now (nothing to show yet). */
export function isFuturePeriod(kind: PeriodKind, anchor: string, tz: string): boolean {
  const { start } = bounds(kind, dayjs.tz(anchor, tz));
  return start.isAfter(dayjs().tz(tz));
}

/** Local YYYY-MM-DD → UTC instant at local midday (safe for date-only txns). */
export function localDateToInstant(date: string, tz: string): Date {
  return dayjs.tz(`${date} 12:00`, tz).toDate();
}
