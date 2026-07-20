import type { ParsedIntent, TxnRef } from "@finance-butler/shared";
import { extractAmount } from "./amount.js";
import { resolveDate, resolvePeriod } from "./date-resolver.js";
import { suggestCategoryKey, suggestType } from "./category-keywords.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Deterministic Thai parser — layer 2 of the pipeline (after the user's own
 * corrections, before the Claude fallback). Target: ≥80% of real messages
 * resolved here, free and in microseconds. Returns kind:"unknown" when unsure;
 * NEVER guesses an amount it isn't certain about.
 */
export class ThaiRuleParser {
  parse(rawText: string, tz: string, nowUtc?: Date): ParsedIntent {
    const text = rawText.trim().replace(/\s+/gu, " ");
    if (!text) return { kind: "unknown", text: rawText };

    return (
      this.parseCommand(text, tz, nowUtc) ??
      this.parseTransaction(text, tz, nowUtc) ??
      this.parseSearch(text, tz, nowUtc) ?? { kind: "unknown", text }
    );
  }

  // ── commands: stats, edit, delete, restore, help ───────────────────────────

  private parseCommand(text: string, tz: string, nowUtc?: Date): ParsedIntent | null {
    const stats = this.parseStats(text, tz, nowUtc);
    if (stats) return stats;

    // ลบรายการล่าสุด / ลบ #52 / ลบล่าสุด
    const del = text.match(/^ลบ\s*(รายการ)?\s*(ล่าสุด|#?\s*(\d+))?\s*$/u);
    if (del && (del[2] || del[1])) {
      return { kind: "delete", ref: this.toRef(del[2], del[3]) };
    }

    // กู้คืน #52 / กู้คืนล่าสุด
    const restore = text.match(/^กู้คืน\s*(รายการ)?\s*(ล่าสุด|#?\s*(\d+))?\s*$/u);
    if (restore) return { kind: "restore", ref: this.toRef(restore[2], restore[3]) };

    // แก้รายการล่าสุดเป็น 150 / แก้ #52 เป็น 150
    const editAmt = text.match(/^แก้\s*(รายการ)?\s*(ล่าสุด|#?\s*(\d+))?\s*เป็น\s*(.+)$/u);
    if (editAmt?.[4]) {
      const amt = extractAmount(editAmt[4]);
      if (amt) {
        return { kind: "edit", ref: this.toRef(editAmt[2], editAmt[3]), patch: { amount: amt.amount } };
      }
    }

    // เปลี่ยนหมวด(ของ #52)?เป็นอาหาร
    const editCat = text.match(/^เปลี่ยน\s*หมวด(หมู่)?\s*(#?\s*(\d+))?\s*เป็น\s*(.+)$/u);
    if (editCat?.[4]) {
      return {
        kind: "edit",
        ref: this.toRef(editCat[2], editCat[3]),
        patch: { categoryHint: editCat[4].trim() },
      };
    }

    // เปลี่ยนบัญชีเป็น SCB
    const editAcc = text.match(/^เปลี่ยน\s*บัญชี\s*(#?\s*(\d+))?\s*เป็น\s*(.+)$/u);
    if (editAcc?.[3]) {
      return {
        kind: "edit",
        ref: this.toRef(editAcc[1], editAcc[2]),
        patch: { accountHint: editAcc[3].trim() },
      };
    }

    if (/^(ช่วยเหลือ|help|วิธีใช้|ใช้ยังไง|เมนู)$/iu.test(text)) {
      return { kind: "question", text: "__help__" };
    }

    return null;
  }

  /**
   * Summaries for any period:
   *   สรุป | สรุปวันนี้ | สรุปเมื่อวาน | สรุปสัปดาห์ที่แล้ว | สรุปเดือนที่แล้ว |
   *   สรุป ก.ค. | สรุป มิ.ย. 2568 | สรุป 15 ก.ค. | สรุปปี 2568 | สรุปปีที่แล้ว
   * Bare period words work too (เดือนนี้, เมื่อวาน, ก.ค., ไตรมาสนี้ …) as long as
   * the whole message is just the period phrase.
   */
  private parseStats(text: string, tz: string, nowUtc?: Date): ParsedIntent | null {
    const prefixed = text.match(/^สรุป\s*(.*)$/u);
    const phrase = prefixed ? (prefixed[1] ?? "").trim() : text;

    if (prefixed && !phrase) {
      const today = (nowUtc ? dayjs(nowUtc).tz(tz) : dayjs().tz(tz)).format("YYYY-MM-DD");
      return { kind: "stats", period: "day", date: today };
    }

    const p = resolvePeriod(phrase, tz, nowUtc);
    if (p && !phrase.replace(p.matchedText, "").trim()) {
      return { kind: "stats", period: p.period, date: p.anchor };
    }

    // "สรุป 15 ก.ค." → day summary of that date (only with the สรุป prefix)
    if (prefixed) {
      const d = resolveDate(phrase, tz, nowUtc);
      if (d && !phrase.replace(d.matchedText, "").trim()) {
        return { kind: "stats", period: "day", date: d.date };
      }
    }
    return null;
  }

  private toRef(word: string | undefined, num: string | undefined): TxnRef {
    if (num) return { by: "shortRef", shortRef: Number(num) };
    return { by: "last" };
  }

  // ── add transaction: "เมื่อวานกินข้าว 70", "เงินเดือน 35000" ─────────────

  private parseTransaction(text: string, tz: string, nowUtc?: Date): ParsedIntent | null {
    // strip date phrase FIRST so "15 ก.ค. ค่าไฟ 900" doesn't read 15 as baht
    const dateMatch = resolveDate(text, tz, nowUtc);
    let rest = dateMatch ? text.replace(dateMatch.matchedText, " ") : text;

    const amt = extractAmount(rest);
    if (!amt) return null;

    const description = (rest.slice(0, amt.index) + rest.slice(amt.index + amt.matchedText.length))
      .replace(/\s+/gu, " ")
      .trim();
    if (!description) return null; // bare number → let AI/unknown handle

    const type = suggestType(description);
    const categoryHint = suggestCategoryKey(description);
    const merchant = description.match(/[A-Za-z][A-Za-z0-9&._'-]+(?:\s+[A-Za-z][A-Za-z0-9&._'-]+)?/u)?.[0];

    const today = (nowUtc ? dayjs(nowUtc).tz(tz) : dayjs().tz(tz)).format("YYYY-MM-DD");
    return {
      kind: "add_transaction",
      type,
      amount: amt.amount,
      description,
      ...(merchant ? { merchant } : {}),
      ...(categoryHint ? { categoryHint } : {}),
      occurredAt: dateMatch?.date ?? today,
      parsedBy: "rules",
      confidence: categoryHint ? 0.9 : 0.7,
    };
  }

  // ── search: "กาแฟเดือนนี้", "ค่าอาหารปีนี้", "ค้นหาร้าน Amazon" ──────────

  private parseSearch(text: string, tz: string, nowUtc?: Date): ParsedIntent | null {
    const explicit = text.match(/^ค้นหา\s*(ร้าน)?\s*(.+)$/u);
    const period = resolvePeriod(text, tz, nowUtc);
    if (!explicit && !period) return null;

    let term = explicit?.[2] ?? text;
    if (period) term = term.replace(period.matchedText, " ");
    term = term.replace(/^ค่า/u, "").replace(/\s+/gu, " ").trim();
    if (!explicit && !term) return null; // bare "เดือนนี้" is a stats command, handled earlier

    const categoryHint = suggestCategoryKey(term);
    const range = period ? this.periodRange(period.period, period.anchor, tz) : undefined;
    return {
      kind: "search",
      query: {
        ...(term ? { text: term } : {}),
        ...(categoryHint ? { categoryHint } : {}),
        ...(range ? { from: range.from, to: range.to } : {}),
      },
    };
  }

  private periodRange(
    period: "day" | "week" | "month" | "quarter" | "year",
    anchor: string,
    tz: string,
  ): { from: string; to: string } {
    const d = dayjs.tz(anchor, tz);
    // quarter approximated as month for chat search; stats handles true quarters
    const unit =
      period === "day" ? "day" : period === "week" ? "week" : period === "year" ? "year" : "month";
    return { from: d.startOf(unit).format("YYYY-MM-DD"), to: d.endOf(unit).format("YYYY-MM-DD") };
  }
}
