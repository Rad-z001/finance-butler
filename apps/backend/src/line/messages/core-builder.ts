import type { messagingApi } from "@line/bot-sdk";
import type {
  AccountView, BudgetAlertView, CategoryView, ErrorKind, GoalView,
  ReceiptView, SlipView, StatsView, TxnView,
} from "@finance-butler/shared";
import type { IMessageBuilder, LineMessage } from "../../entities/ports/message-builder.js";

/**
 * Visual Flex design system for Finance Butler.
 * Palette + bar components shared by every card; pure functions, no I/O.
 * (TASK-04 may refine further — postback protocol unchanged.)
 */

const GREEN = "#06C755";
const RED = "#EF454D";
const GRAY = "#8C8C9A";
const DARK = "#1F2A44";
const LIGHT_BG = "#F5F6FA";
const TRACK = "#E8EAF1";
const BAR_COLORS = ["#4C6FFF", "#06C755", "#FFB020", "#EF454D", "#9B59F6", "#00B8D9"];

type Flex = messagingApi.FlexComponent;

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

function txt(
  t: string,
  opts: { size?: string; color?: string; weight?: "bold" | "regular"; align?: "start" | "end" | "center"; flex?: number; margin?: string } = {},
): Flex {
  return {
    type: "text",
    text: t,
    wrap: true,
    size: opts.size ?? "sm",
    ...(opts.color ? { color: opts.color } : {}),
    ...(opts.weight === "bold" ? { weight: "bold" } : {}),
    ...(opts.align ? { align: opts.align } : {}),
    ...(opts.flex !== undefined ? { flex: opts.flex } : {}),
    ...(opts.margin ? { margin: opts.margin } : {}),
  };
}

function kv(label: string, value: string, valueColor?: string): Flex {
  return {
    type: "box",
    layout: "horizontal",
    margin: "sm",
    contents: [
      txt(label, { color: GRAY, flex: 5 }),
      txt(value, { align: "end", flex: 5, weight: "bold", ...(valueColor ? { color: valueColor } : {}) }),
    ],
  };
}

/** Horizontal progress bar (the classic Flex nested-box trick). */
function bar(pct: number, color: string): Flex {
  const width = `${Math.min(100, Math.max(2, Math.round(pct)))}%`;
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: TRACK,
    cornerRadius: "sm",
    height: "6px",
    margin: "sm",
    contents: [
      {
        type: "box",
        layout: "vertical",
        backgroundColor: color,
        cornerRadius: "sm",
        height: "6px",
        width,
        contents: [{ type: "filler" }],
      },
    ],
  };
}

/** Labeled bar row: "🍚 อาหาร   1,200฿ (45%)" + bar underneath. */
function barRow(label: string, value: string, pct: number, color: string): Flex {
  return {
    type: "box",
    layout: "vertical",
    margin: "md",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          txt(label, { flex: 6, color: DARK }),
          txt(value, { align: "end", flex: 5, color: GRAY, size: "xs" }),
        ],
      },
      bar(pct, color),
    ],
  };
}

function card(opts: {
  altText: string;
  headerBg: string;
  headerRows: Flex[];
  body: Flex[];
  size?: messagingApi.FlexBubble["size"];
}): messagingApi.FlexMessage {
  return {
    type: "flex",
    altText: opts.altText,
    contents: {
      type: "bubble",
      size: opts.size ?? "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: opts.headerBg,
        paddingAll: "16px",
        contents: opts.headerRows,
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: opts.body,
      },
    },
  };
}

export class CoreMessageBuilder implements IMessageBuilder {
  welcome(displayName: string): LineMessage[] {
    const m = card({
      altText: `สวัสดี ${displayName}`,
      headerBg: DARK,
      headerRows: [
        txt("🤵 Finance Butler", { color: "#FFFFFF", weight: "bold", size: "lg" }),
        txt(`สวัสดี ${displayName} — เลขาการเงินส่วนตัวของคุณ`, { color: "#C9D2E3", size: "xs", margin: "sm" }),
      ],
      body: [
        txt("พิมพ์บอกได้เลย เช่น", { color: GRAY, size: "xs" }),
        txt("• กินข้าว 80", { margin: "sm" }),
        txt("• เงินเดือน 35000"),
        txt("• ข้าวเช้า 25 น้ำเปล่า 7  (หลายรายการก็ได้)"),
        txt("• เมื่อวานกาแฟ 65"),
        { type: "separator", margin: "md" },
        txt("ดูสรุป: “สรุปวันนี้” / “เดือนนี้”  •  แก้/ลบ: “แก้รายการล่าสุดเป็น 150”, “ลบ #52”", {
          color: GRAY,
          size: "xs",
          margin: "md",
        }),
      ],
    });
    m.quickReply = { items: [msg("สรุปวันนี้"), msg("ช่วยเหลือ")] };
    return [m];
  }

  welcomeGroup(groupName: string): LineMessage[] {
    const m = card({
      altText: `สวัสดีกลุ่ม ${groupName}`,
      headerBg: DARK,
      headerRows: [
        txt("💑 กระเป๋ากลางของกลุ่ม", { color: "#FFFFFF", weight: "bold", size: "lg" }),
        txt(`"${groupName}" มีสมุดบัญชีร่วมกันแล้ว`, { color: "#C9D2E3", size: "xs", margin: "sm" }),
      ],
      body: [
        txt("ใครจ่ายอะไร พิมพ์ในกลุ่มได้เลย เช่น", { color: GRAY, size: "xs" }),
        txt("• ค่าข้าวเย็น 450", { margin: "sm" }),
        txt("• ค่าน้ำมัน 800"),
        txt("ผมจดให้พร้อมชื่อคนจ่าย 📝", { margin: "md" }),
        { type: "separator", margin: "md" },
        txt("“สรุปเดือนนี้” — มียอดแยกรายคนให้ด้วย • สมุดส่วนตัวของแต่ละคนอยู่ในแชทเดี่ยว ไม่ปนกัน", {
          color: GRAY,
          size: "xs",
          margin: "md",
        }),
      ],
    });
    m.quickReply = { items: [msg("สรุปเดือนนี้"), msg("ช่วยเหลือ")] };
    return [m];
  }

  txnSaved(txn: TxnView, accountBalance: string): LineMessage[] {
    const isIncome = txn.type === "INCOME";
    const accent = isIncome ? GREEN : RED;
    const m = card({
      altText: `บันทึกแล้ว ${txn.description} ${txn.amount}฿`,
      headerBg: accent,
      headerRows: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            txt(`✅ บันทึกแล้ว #${txn.shortRef}`, { color: "#FFFFFF", size: "xs", flex: 6 }),
            txt(txn.occurredAt, { color: "#FFFFFFCC", size: "xs", align: "end", flex: 4 }),
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            txt(`${txn.categoryIcon} ${txn.description || txn.categoryName}`, {
              color: "#FFFFFF",
              weight: "bold",
              size: "md",
              flex: 6,
            }),
            txt(`${isIncome ? "+" : "−"}${txn.amount}฿`, {
              color: "#FFFFFF",
              weight: "bold",
              size: "lg",
              align: "end",
              flex: 5,
            }),
          ],
        },
      ],
      body: [
        kv("หมวด", `${txn.categoryIcon} ${txn.categoryName}`),
        ...(txn.actorName ? [kv("จ่ายโดย", `👤 ${txn.actorName}`)] : []),
        kv(`ยอด ${txn.accountName}`, `${accountBalance}฿`, DARK),
      ],
    });
    m.quickReply = {
      items: [pb("แก้หมวด", `a=chcat&id=${txn.id}`), pb("ลบรายการนี้", `a=delask&id=${txn.id}`), msg("สรุปวันนี้")],
    };
    return [m];
  }

  txnBatchSaved(txns: TxnView[], accountBalance: string): LineMessage[] {
    const total = txns.length;
    const rows: Flex[] = txns.map((t) =>
      kv(
        `#${t.shortRef} ${t.categoryIcon} ${(t.description || t.categoryName).slice(0, 24)}`,
        `${t.type === "INCOME" ? "+" : "−"}${t.amount}฿`,
        t.type === "INCOME" ? GREEN : RED,
      ),
    );
    rows.push({ type: "separator", margin: "md" });
    if (txns[0]?.actorName) rows.push(kv("จ่ายโดย", `👤 ${txns[0].actorName}`));
    rows.push(kv("ยอดคงเหลือ", `${accountBalance}฿`, DARK));
    const m = card({
      altText: `บันทึกแล้ว ${total} รายการ`,
      headerBg: RED,
      headerRows: [txt(`✅ บันทึกแล้ว ${total} รายการ`, { color: "#FFFFFF", weight: "bold", size: "md" })],
      body: rows,
    });
    m.quickReply = { items: [msg("สรุปวันนี้"), pb("ลบรายการล่าสุด", "a=delask_last")] };
    return [m];
  }

  txnList(items: TxnView[], totalAmount: string, title: string): LineMessage[] {
    if (items.length === 0) return [text(`ไม่พบรายการ${title ? ` (${title})` : ""} 🔍`)];
    const rows: Flex[] = items.map((t) =>
      kv(
        `${t.categoryIcon} ${t.occurredAt} ${(t.description || t.categoryName).slice(0, 22)}`,
        `${t.type === "INCOME" ? "+" : "−"}${t.amount}฿`,
        t.type === "INCOME" ? GREEN : RED,
      ),
    );
    rows.push({ type: "separator", margin: "md" });
    rows.push(kv(`รวม ${items.length} รายการ`, `${totalAmount}฿`, DARK));
    return [
      card({
        altText: `ผลค้นหา ${title}`,
        headerBg: DARK,
        headerRows: [txt(`🔍 ${title}`, { color: "#FFFFFF", weight: "bold" })],
        body: rows,
      }),
    ];
  }

  statsSummary(s: StatsView): LineMessage[] {
    const body: Flex[] = [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "box",
            layout: "vertical",
            flex: 1,
            backgroundColor: LIGHT_BG,
            cornerRadius: "md",
            paddingAll: "10px",
            contents: [
              txt("รายรับ", { color: GRAY, size: "xxs" }),
              txt(`+${s.income}`, { color: GREEN, weight: "bold", size: "sm", margin: "xs" }),
            ],
          },
          {
            type: "box",
            layout: "vertical",
            flex: 1,
            margin: "sm",
            backgroundColor: LIGHT_BG,
            cornerRadius: "md",
            paddingAll: "10px",
            contents: [
              txt("รายจ่าย", { color: GRAY, size: "xxs" }),
              txt(`−${s.expense}`, { color: RED, weight: "bold", size: "sm", margin: "xs" }),
            ],
          },
        ],
      },
      kv("เงินในบัญชีรวม", `${s.totalBalance}฿`, DARK),
    ];
    if (s.expenseChangePct !== null) {
      const up = s.expenseChangePct > 0;
      body.push(
        kv(
          "รายจ่ายเทียบช่วงก่อนหน้า",
          `${up ? "🔺 +" : s.expenseChangePct < 0 ? "🔻 " : ""}${s.expenseChangePct}%`,
          up ? RED : GREEN,
        ),
      );
    }
    if (s.topCategories.length > 0) {
      body.push({ type: "separator", margin: "lg" });
      body.push(txt("หมวดใช้จ่ายสูงสุด", { color: GRAY, size: "xs", margin: "md" }));
      s.topCategories.forEach((c, i) => {
        body.push(barRow(`${c.icon} ${c.name}`, `${c.amount}฿ (${c.pct}%)`, c.pct, BAR_COLORS[i % BAR_COLORS.length] ?? GREEN));
      });
    }
    if (s.payerBreakdown.length > 0) {
      body.push({ type: "separator", margin: "lg" });
      body.push(txt("ใครจ่ายบ้าง", { color: GRAY, size: "xs", margin: "md" }));
      s.payerBreakdown.forEach((payer, i) => {
        body.push(
          barRow(`👤 ${payer.name}`, `${payer.amount}฿ (${payer.pct}%)`, payer.pct, BAR_COLORS[(i + 1) % BAR_COLORS.length] ?? GREEN),
        );
      });
    }

    const m = card({
      altText: `สรุป${s.periodLabel}`,
      headerBg: DARK,
      size: "mega",
      headerRows: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            txt(`📊 สรุป${s.periodLabel}`, { color: "#FFFFFF", weight: "bold", size: "md", flex: 7 }),
            txt(`${s.txnCount} รายการ`, { color: "#C9D2E3", size: "xs", align: "end", flex: 3 }),
          ],
        },
        txt(`คงเหลือสุทธิ ${s.net}฿`, { color: "#FFFFFF", size: "xl", weight: "bold", margin: "md" }),
      ],
      body,
    });
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
    const color = a.level >= 100 ? RED : a.level >= 80 ? "#FFB020" : GREEN;
    return [
      card({
        altText: `งบ${a.categoryName}ใช้ไป ${a.level}%`,
        headerBg: color,
        headerRows: [
          txt(`${icon} งบ${a.categoryName}ใช้ไป ${a.level}%`, { color: "#FFFFFF", weight: "bold" }),
        ],
        body: [kv("ใช้ไป / งบ", `${a.spent} / ${a.limit}฿`), bar(a.level, color)],
      }),
    ];
  }

  goalProgress(g: GoalView): LineMessage[] {
    return [
      card({
        altText: `เป้าหมาย ${g.name} ${g.pct}%`,
        headerBg: DARK,
        headerRows: [txt(`🎯 ${g.name}`, { color: "#FFFFFF", weight: "bold" })],
        body: [kv("ออมแล้ว / เป้า", `${g.current} / ${g.target}฿`, DARK), bar(g.pct, GREEN), txt(`${g.pct}%`, { color: GRAY, size: "xs", align: "end", margin: "sm" })],
      }),
    ];
  }

  accountPicker(accounts: AccountView[]): LineMessage[] {
    const items = accounts.slice(0, 13).map((a) => pb(a.name.slice(0, 20), `a=setacc&id=${a.id}`));
    return [text("เลือกบัญชี 👇", items)];
  }

  dailyReminder(): LineMessage[] {
    return [text("วันนี้มีรายรับรายจ่ายเพิ่มเติมไหม 😊", [msg("สรุปวันนี้"), msg("ไม่มี")])];
  }

  help(): LineMessage[] {
    const section = (title: string, lines: string[]): Flex[] => [
      txt(title, { color: GRAY, size: "xs", margin: "md" }),
      ...lines.map((l) => txt(l, { margin: "xs", size: "xs", color: DARK })),
    ];
    return [
      card({
        altText: "วิธีใช้ Finance Butler",
        headerBg: DARK,
        headerRows: [txt("🤵 วิธีใช้ Finance Butler", { color: "#FFFFFF", weight: "bold" })],
        body: [
          ...section("บันทึกรายการ", ["กินข้าว 80  •  เงินเดือน 35000", "ข้าวเช้า 25 น้ำเปล่า 7  (หลายรายการ)", "เมื่อวานกาแฟ 65  •  15 ก.ค. ค่าไฟ 900"]),
          ...section("ดูสรุป", ["สรุปวันนี้ / สัปดาห์นี้ / เดือนนี้ / ปีนี้", "สรุปเดือนที่แล้ว  •  สรุป มิ.ย.  •  สรุปปี 2568"]),
          ...section("ค้นหา / แก้ไข / ลบ", ["กาแฟเดือนนี้  •  ค้นหาร้าน Amazon", "แก้รายการล่าสุดเป็น 150  •  เปลี่ยนหมวดเป็นอาหาร", "ลบรายการล่าสุด  •  ลบ #52  •  กู้คืน #52"]),
        ],
      }),
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
