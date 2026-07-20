import type { messagingApi } from "@line/bot-sdk";
import type {
  AccountView, BudgetAlertView, CategoryView, ErrorKind, GoalView,
  ReceiptView, SlipView, StatsView, TxnView,
} from "@finance-butler/shared";
import type { IMessageBuilder, LineMessage } from "../../entities/ports/message-builder.js";

/**
 * Core implementation of IMessageBuilder — functional, clean, replaced with
 * polished designs by TASK-04. Pure functions; postback protocol documented
 * in tasks/TASK-04-LINE-RICH-UI.md (a=del|delc|chcat|setcat|...).
 */

const GREEN = "#06C755";
const RED = "#EF454D";
const GRAY = "#8C8C8C";

function text(t: string, quickReplies?: messagingApi.QuickReplyItem[]): LineMessage {
  return {
    type: "text",
    text: t,
    ...(quickReplies ? { quickReply: { items: quickReplies } } : {}),
  };
}

function pb(label: string, data: string): messagingApi.QuickReplyItem {
  return { type: "action", action: { type: "postback", label, data, displayText: label } };
}

function msg(label: string): messagingApi.QuickReplyItem {
  return { type: "action", action: { type: "message", label, text: label } };
}

function kv(label: string, value: string, color?: string): messagingApi.FlexComponent {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: GRAY, flex: 4 },
      { type: "text", text: value, size: "sm", align: "end", flex: 5, ...(color ? { color } : {}), weight: "bold" },
    ],
  };
}

function bubble(altText: string, header: string, body: messagingApi.FlexComponent[]): LineMessage {
  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: header, weight: "bold", size: "md" },
          { type: "separator", margin: "sm" },
          ...body,
        ],
      },
    },
  };
}

export class CoreMessageBuilder implements IMessageBuilder {
  welcome(displayName: string): LineMessage[] {
    return [
      text(
        `สวัสดี ${displayName} 👋 ผม Finance Butler เลขาการเงินส่วนตัวของคุณ\n\n` +
          `พิมพ์บอกได้เลย เช่น\n` +
          `• กินข้าว 80\n• เงินเดือน 35000\n• เมื่อวานกาแฟ 65\n\n` +
          `ดูสรุป: พิมพ์ "สรุปวันนี้" หรือ "เดือนนี้"\nลบ/แก้ไข: "ลบรายการล่าสุด", "แก้รายการล่าสุดเป็น 150"`,
        [msg("สรุปวันนี้"), msg("ช่วยเหลือ")],
      ),
    ];
  }

  welcomeGroup(groupName: string): LineMessage[] {
    return [
      text(
        `สวัสดีทุกคนในกลุ่ม "${groupName}" 💑\n` +
          `ผม Finance Butler — จากนี้กลุ่มนี้มี "กระเป๋ากลาง" ร่วมกันแล้ว\n\n` +
          `ใครจ่ายอะไร พิมพ์ในกลุ่มได้เลย เช่น\n• ค่าข้าวเย็น 450\n• ค่าน้ำมัน 800\n\n` +
          `ผมจะจดให้พร้อมชื่อคนจ่าย 📝\nดูสรุป: พิมพ์ "สรุปเดือนนี้" — มียอดแยกรายคนให้ด้วย\n\n` +
          `(สมุดส่วนตัวของแต่ละคนยังอยู่ในแชทเดี่ยวกับผมเหมือนเดิม ไม่ปนกัน)`,
        [msg("สรุปเดือนนี้"), msg("ช่วยเหลือ")],
      ),
    ];
  }

  txnSaved(txn: TxnView, accountBalance: string): LineMessage[] {
    const isIncome = txn.type === "INCOME";
    const m = bubble(
      `บันทึกแล้ว ${txn.description} ${txn.amount}฿`,
      `✅ บันทึกแล้ว #${txn.shortRef}`,
      [
        kv(`${txn.categoryIcon} ${txn.categoryName}`, `${isIncome ? "+" : "−"}${txn.amount}฿`, isIncome ? GREEN : RED),
        kv("รายการ", txn.description || "-"),
        ...(txn.actorName ? [kv("จ่ายโดย", `👤 ${txn.actorName}`)] : []),
        kv("วันที่", txn.occurredAt),
        kv(`ยอด ${txn.accountName}`, `${accountBalance}฿`),
      ],
    ) as messagingApi.FlexMessage;
    m.quickReply = {
      items: [pb("แก้หมวด", `a=chcat&id=${txn.id}`), pb("ลบรายการนี้", `a=delask&id=${txn.id}`), msg("สรุปวันนี้")],
    };
    return [m];
  }

  txnBatchSaved(txns: TxnView[], accountBalance: string): LineMessage[] {
    const rows = txns.map((t) =>
      kv(
        `#${t.shortRef} ${t.categoryIcon} ${t.description || t.categoryName}`.slice(0, 40),
        `${t.type === "INCOME" ? "+" : "−"}${t.amount}฿`,
        t.type === "INCOME" ? GREEN : RED,
      ),
    );
    rows.push({ type: "separator", margin: "sm" } as messagingApi.FlexComponent);
    if (txns[0]?.actorName) rows.push(kv("จ่ายโดย", `👤 ${txns[0].actorName}`));
    rows.push(kv("ยอดคงเหลือ", `${accountBalance}฿`));
    const m = bubble(
      `บันทึกแล้ว ${txns.length} รายการ`,
      `✅ บันทึกแล้ว ${txns.length} รายการ`,
      rows,
    ) as messagingApi.FlexMessage;
    m.quickReply = { items: [msg("สรุปวันนี้"), pb("ลบรายการล่าสุด", "a=delask_last")] };
    return [m];
  }

  txnList(items: TxnView[], totalAmount: string, title: string): LineMessage[] {
    if (items.length === 0) return [text(`ไม่พบรายการ${title ? ` (${title})` : ""} 🔍`)];
    const rows = items.map((t) =>
      kv(
        `${t.categoryIcon} ${t.occurredAt} ${t.description || t.categoryName}`.slice(0, 40),
        `${t.type === "INCOME" ? "+" : "−"}${t.amount}฿`,
        t.type === "INCOME" ? GREEN : RED,
      ),
    );
    rows.push({ type: "separator", margin: "sm" } as messagingApi.FlexComponent);
    rows.push(kv(`รวม ${items.length} รายการ`, `${totalAmount}฿`));
    return [bubble(`ผลค้นหา ${title}`, `🔍 ${title}`, rows)];
  }

  statsSummary(s: StatsView): LineMessage[] {
    const body: messagingApi.FlexComponent[] = [
      kv("รายรับ", `+${s.income}฿`, GREEN),
      kv("รายจ่าย", `−${s.expense}฿`, RED),
      kv("คงเหลือสุทธิ", `${s.net}฿`),
      kv("เงินในบัญชีรวม", `${s.totalBalance}฿`),
    ];
    if (s.expenseChangePct !== null) {
      const up = s.expenseChangePct > 0;
      body.push(
        kv(
          "เทียบช่วงก่อนหน้า",
          `${up ? "🔺 +" : s.expenseChangePct < 0 ? "🔻 " : ""}${s.expenseChangePct}%`,
          up ? RED : GREEN,
        ),
      );
    }
    if (s.topCategories.length > 0) {
      body.push({ type: "separator", margin: "sm" });
      body.push({ type: "text", text: "หมวดใช้จ่ายสูงสุด", size: "xs", color: GRAY, margin: "sm" });
      for (const c of s.topCategories) {
        body.push(kv(`${c.icon} ${c.name}`, `${c.amount}฿ (${c.pct}%)`));
      }
    }
    if (s.payerBreakdown.length > 0) {
      body.push({ type: "separator", margin: "sm" });
      body.push({ type: "text", text: "ใครจ่ายบ้าง", size: "xs", color: GRAY, margin: "sm" });
      for (const payer of s.payerBreakdown) {
        body.push(kv(`${payer.icon} ${payer.name}`, `${payer.amount}฿ (${payer.pct}%)`));
      }
    }
    const m = bubble(
      `สรุป${s.periodLabel}`,
      `📊 สรุป${s.periodLabel} (${s.txnCount} รายการ)`,
      body,
    ) as messagingApi.FlexMessage;
    const items = [pb("◀ ช่วงก่อนหน้า", `a=stats&p=${s.period}&d=${s.prevAnchor}`)];
    if (s.nextAnchor) items.push(pb("ช่วงถัดไป ▶", `a=stats&p=${s.period}&d=${s.nextAnchor}`));
    items.push(msg("สรุปวันนี้"), msg("สัปดาห์นี้"), msg("เดือนนี้"), msg("ปีนี้"));
    m.quickReply = { items };
    return [m];
  }

  deleteConfirm(txn: TxnView): LineMessage[] {
    return [
      text(
        `ยืนยันลบรายการนี้?\n#${txn.shortRef} ${txn.categoryIcon} ${txn.description || txn.categoryName} −${txn.amount}฿ (${txn.occurredAt})`,
        [pb("✅ ยืนยันลบ", `a=del&id=${txn.id}`), pb("ยกเลิก", "a=delc")],
      ),
    ];
  }

  deleted(txn: TxnView): LineMessage[] {
    return [text(`🗑 ลบ #${txn.shortRef} แล้ว (พิมพ์ "กู้คืน #${txn.shortRef}" เพื่อเรียกคืน)`)];
  }

  restored(txn: TxnView): LineMessage[] {
    return [text(`↩️ กู้คืน #${txn.shortRef} ${txn.description} ${txn.amount}฿ เรียบร้อย`)];
  }

  edited(txn: TxnView): LineMessage[] {
    return [
      text(
        `✏️ แก้ไข #${txn.shortRef} แล้ว\n${txn.categoryIcon} ${txn.categoryName} • ${txn.description || "-"} • ${txn.amount}฿ • ${txn.accountName}`,
      ),
    ];
  }

  categoryPicker(txnId: string, categories: CategoryView[]): LineMessage[] {
    const items = categories
      .slice(0, 13)
      .map((c) => pb(`${c.icon} ${c.nameTh}`.slice(0, 20), `a=setcat&id=${txnId}&cat=${c.id}`));
    return [text("เลือกหมวดใหม่ 👇", items)];
  }

  slipConfirm(slip: SlipView): LineMessage[] {
    return [
      text(
        `📄 อ่านสลิปได้: ${slip.amount}฿${slip.bank ? ` (${slip.bank})` : ""}\nบันทึกเป็นรายรับหรือรายจ่าย?`,
        [pb("รายรับ", `a=slip&id=${slip.slipId}&t=IN`), pb("รายจ่าย", `a=slip&id=${slip.slipId}&t=EX`), pb("ยกเลิก", "a=slipc")],
      ),
    ];
  }

  receiptConfirm(r: ReceiptView): LineMessage[] {
    return [
      text(
        `🧾 ${r.storeName ?? "ใบเสร็จ"} รวม ${r.total}฿ (${r.itemCount} รายการ)` +
          (r.suggestedCategory ? `\nหมวดที่แนะนำ: ${r.suggestedCategory}` : ""),
        [pb("บันทึกเลย", `a=rcpt&id=${r.receiptId}`), pb("ยกเลิก", "a=rcptc")],
      ),
    ];
  }

  budgetAlert(a: BudgetAlertView): LineMessage[] {
    const icon = a.level >= 100 ? "🚨" : a.level >= 80 ? "⚠️" : "📣";
    return [text(`${icon} งบ${a.categoryName}ใช้ไป ${a.level}% แล้ว (${a.spent}/${a.limit}฿)`)];
  }

  goalProgress(g: GoalView): LineMessage[] {
    return [text(`🎯 ${g.name}: ${g.current}/${g.target}฿ (${g.pct}%)`)];
  }

  accountPicker(accounts: AccountView[]): LineMessage[] {
    const items = accounts.slice(0, 13).map((a) => pb(a.name.slice(0, 20), `a=setacc&id=${a.id}`));
    return [text("เลือกบัญชี 👇", items)];
  }

  dailyReminder(): LineMessage[] {
    return [text("วันนี้มีรายรับรายจ่ายเพิ่มเติมไหม 😊", [msg("สรุปวันนี้"), msg("ไม่มี")])];
  }

  help(): LineMessage[] {
    return [
      text(
        `🤵 วิธีใช้ Finance Butler\n\n` +
          `บันทึก: "กินข้าว 80", "เงินเดือน 35000", "เมื่อวานกาแฟ 65", "15 ก.ค. ค่าไฟ 900"\n` +
          `สรุป: "สรุปวันนี้" / "เมื่อวาน" / "สัปดาห์นี้" / "เดือนที่แล้ว" / "สรุป มิ.ย." / "สรุปปี 2568"\n` +
          `ค้นหา: "กาแฟเดือนนี้", "ค้นหาร้าน Amazon"\n` +
          `แก้ไข: "แก้รายการล่าสุดเป็น 150", "เปลี่ยนหมวดเป็นอาหาร"\n` +
          `ลบ: "ลบรายการล่าสุด", "ลบ #52"\n\n` +
          `ถามอะไรเกี่ยวกับการเงินก็ได้เลย 💬`,
      ),
    ];
  }

  error(kind: ErrorKind): LineMessage[] {
    const msgs: Record<ErrorKind, string> = {
      not_found: "หารายการไม่เจอ 🔍 ลองพิมพ์ 'สรุปวันนี้' ดูรายการล่าสุด",
      cannot_parse: `ยังไม่เข้าใจข้อความนี้ 🙏 ลองพิมพ์แบบนี้ดู เช่น "กินข้าว 80" หรือพิมพ์ "ช่วยเหลือ"`,
      internal: "ระบบขัดข้องชั่วคราว ขอโทษด้วย 🙏 ลองใหม่อีกครั้ง",
      not_yet: "ฟีเจอร์นี้กำลังพัฒนา จะเปิดให้ใช้เร็วๆ นี้ 🚧",
    };
    return [text(msgs[kind])];
  }
}
