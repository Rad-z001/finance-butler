import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export type PeriodKind = "day" | "week" | "month" | "quarter" | "year";

export interface DateRange {
  /** inclusive UTC instants covering the local period */
  from: Date;
  to: Date;
  label: string;
}

const LABELS: Record<PeriodKind, string> = {
  day: "วันนี้",
  week: "สัปดาห์นี้",
  month: "เดือนนี้",
  quarter: "ไตรมาสนี้",
  year: "ปีนี้",
};

/** Local-timezone period boundaries as UTC instants for DB queries. */
export function periodRange(kind: PeriodKind, tz: string, anchorDate?: string): DateRange {
  const anchor = anchorDate ? dayjs.tz(anchorDate, tz) : dayjs().tz(tz);
  const unit = kind === "quarter" ? "month" : kind;
  let start = anchor.startOf(unit);
  let end = anchor.endOf(unit);
  if (kind === "quarter") {
    const qStartMonth = Math.floor(anchor.month() / 3) * 3;
    start = anchor.month(qStartMonth).startOf("month");
    end = anchor.month(qStartMonth + 2).endOf("month");
  }
  const isCurrent = anchor.isSame(dayjs().tz(tz), unit);
  const label = isCurrent
    ? LABELS[kind]
    : kind === "month"
      ? start.format("MMM YYYY")
      : `${start.format("D MMM")} – ${end.format("D MMM YYYY")}`;
  return { from: start.toDate(), to: end.toDate(), label };
}

/** Local YYYY-MM-DD → UTC instant at local midday (safe for date-only txns). */
export function localDateToInstant(date: string, tz: string): Date {
  return dayjs.tz(`${date} 12:00`, tz).toDate();
}
