import type { User } from "@prisma/client";
import type { ParsedIntent } from "@finance-butler/shared";
import type { IMessageBuilder, LineMessage } from "../entities/ports/message-builder.js";
import type { CategoryService } from "../services/category.service.js";
import type { StatsService } from "../services/stats.service.js";
import type { TransactionService } from "../services/transaction.service.js";
import type { UserService } from "../services/user.service.js";
import type { IAiClient } from "../ai/claude.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface DispatchCtx {
  /** group-ledger mode: which member sent the message */
  actorName?: string;
  actorLineUserId?: string;
}

/** Routes a ParsedIntent to the right service and returns the reply messages. */
export class IntentDispatcher {
  constructor(
    private readonly users: UserService,
    private readonly txns: TransactionService,
    private readonly categories: CategoryService,
    private readonly stats: StatsService,
    private readonly ai: IAiClient,
    private readonly msg: IMessageBuilder,
  ) {}

  async dispatch(user: User, intent: ParsedIntent, ctx: DispatchCtx = {}): Promise<LineMessage[]> {
    try {
      switch (intent.kind) {
        case "add_transaction": {
          const account = await this.users.defaultAccount(user.id);
          const category = await this.categories.resolveForTransaction(
            user.id,
            intent.description,
            intent.merchant,
            intent.categoryHint,
          );
          const { txn, balance } = await this.txns.create({
            userId: user.id,
            accountId: account.id,
            categoryId: category.id,
            type: intent.type,
            amount: intent.amount,
            description: intent.description,
            ...(intent.merchant ? { merchant: intent.merchant } : {}),
            ...(ctx.actorName ? { actorName: ctx.actorName } : {}),
            ...(ctx.actorLineUserId ? { actorLineUserId: ctx.actorLineUserId } : {}),
            occurredAtLocal: intent.occurredAt,
            tz: user.timezone,
            source: "NLP",
          });
          return this.msg.txnSaved(this.txns.toView(txn, user.timezone), balance.toString());
        }

        case "add_transactions": {
          const account = await this.users.defaultAccount(user.id);
          const views = [];
          let balance = "";
          for (const item of intent.items) {
            const category = await this.categories.resolveForTransaction(
              user.id,
              item.description,
              item.merchant,
              item.categoryHint,
            );
            const { txn, balance: b } = await this.txns.create({
              userId: user.id,
              accountId: account.id,
              categoryId: category.id,
              type: item.type,
              amount: item.amount,
              description: item.description,
              ...(item.merchant ? { merchant: item.merchant } : {}),
              ...(ctx.actorName ? { actorName: ctx.actorName } : {}),
              ...(ctx.actorLineUserId ? { actorLineUserId: ctx.actorLineUserId } : {}),
              occurredAtLocal: intent.occurredAt,
              tz: user.timezone,
              source: "NLP",
            });
            views.push(this.txns.toView(txn, user.timezone));
            balance = b.toString();
          }
          return this.msg.txnBatchSaved(views, balance);
        }

        case "stats": {
          const s = await this.stats.summary(user.id, intent.period, user.timezone, intent.date);
          return this.msg.statsSummary(s);
        }

        case "search": {
          const category = intent.query.categoryHint
            ? await this.categories.byHint(user.id, intent.query.categoryHint)
            : null;
          const { items, total } = await this.txns.search(
            user.id,
            intent.query,
            category?.id,
            user.timezone,
          );
          const title = [intent.query.text, category?.nameTh].filter(Boolean).join(" · ") || "ทั้งหมด";
          return this.msg.txnList(
            items.map((t) => this.txns.toView(t, user.timezone)),
            total.toString(),
            title,
          );
        }

        case "edit": {
          let categoryId: string | undefined;
          let accountId: string | undefined;
          if (intent.patch.categoryHint) {
            const cat = await this.categories.byHint(user.id, intent.patch.categoryHint);
            if (!cat) return this.msg.error("not_found");
            categoryId = cat.id;
          }
          if (intent.patch.accountHint) {
            const target = await this.users.findAccountByHint(user.id, intent.patch.accountHint);
            if (!target) return this.msg.error("not_found");
            accountId = target.id;
          }
          const current = await this.txns.findByRef(user.id, intent.ref);
          const updated = await this.txns.edit(user.id, intent.ref, {
            ...(intent.patch.amount ? { amount: intent.patch.amount } : {}),
            ...(categoryId ? { categoryId } : {}),
            ...(accountId ? { accountId } : {}),
            ...(intent.patch.description ? { description: intent.patch.description } : {}),
          });
          // "remember corrections forever" — reassigned category teaches the parser
          if (categoryId && current.description) {
            await this.categories.learnCorrection(user.id, current.description, categoryId);
          }
          return this.msg.edited(this.txns.toView(updated, user.timezone));
        }

        case "delete": {
          const txn = await this.txns.findByRef(user.id, intent.ref);
          return this.msg.deleteConfirm(this.txns.toView(txn, user.timezone));
        }

        case "restore": {
          const txn = await this.txns.restore(user.id, intent.ref);
          return this.msg.restored(this.txns.toView(txn, user.timezone));
        }

        case "question": {
          if (intent.text === "__help__") return this.msg.help();
          const s = await this.stats.summary(user.id, "month", user.timezone);
          const ctx = `เดือนนี้: รายรับ ${s.income}฿ รายจ่าย ${s.expense}฿ คงเหลือ ${s.net}฿ เงินรวม ${s.totalBalance}฿`;
          const answer = await this.ai.answerQuestion(intent.text, ctx);
          return [{ type: "text", text: answer }];
        }

        case "set_budget":
        case "add_goal":
        case "transfer":
          return this.msg.error("not_yet"); // M2/M4 — see tasks/TASK-01-CORE-BACKEND.md

        case "unknown":
          return this.msg.error("cannot_parse");
      }
    } catch (err) {
      if (err instanceof AppError && err.code === "NOT_FOUND") return this.msg.error("not_found");
      logger.error({ err, intent: intent.kind }, "dispatch failed");
      return this.msg.error("internal");
    }
  }

  /** Postback actions from buttons (a=del|delc|chcat|setcat). */
  async dispatchPostback(user: User, data: string): Promise<LineMessage[]> {
    const p = new URLSearchParams(data);
    const action = p.get("a");
    const id = p.get("id");
    try {
      switch (action) {
        case "del": {
          if (!id) return this.msg.error("not_found");
          const deleted = await this.txns.softDelete(user.id, id);
          return this.msg.deleted(this.txns.toView(deleted, user.timezone));
        }
        case "delask": {
          if (!id) return this.msg.error("not_found");
          const txn = await this.txns.findById(user.id, id);
          return this.msg.deleteConfirm(this.txns.toView(txn, user.timezone));
        }
        case "delask_last": {
          const txn = await this.txns.findByRef(user.id, { by: "last" });
          return this.msg.deleteConfirm(this.txns.toView(txn, user.timezone));
        }
        case "delc":
          return [{ type: "text", text: "ยกเลิกแล้ว 👌" }];
        case "stats": {
          const period = p.get("p");
          const date = p.get("d");
          const valid = ["day", "week", "month", "quarter", "year"] as const;
          const kind = valid.find((v) => v === period);
          if (!kind || !date) return this.msg.error("not_found");
          const s = await this.stats.summary(user.id, kind, user.timezone, date);
          return this.msg.statsSummary(s);
        }
        case "chcat": {
          if (!id) return this.msg.error("not_found");
          const cats = await this.categories.list(user.id);
          return this.msg.categoryPicker(
            id,
            cats.map((c) => ({ id: c.id, key: c.key, name: c.name, nameTh: c.nameTh, icon: c.icon })),
          );
        }
        case "setcat": {
          const catId = p.get("cat");
          if (!id || !catId) return this.msg.error("not_found");
          const before = await this.txns.findById(user.id, id);
          const updated = await this.txns.edit(
            user.id,
            { by: "shortRef", shortRef: before.shortRef },
            { categoryId: catId },
          );
          if (before.description) {
            await this.categories.learnCorrection(user.id, before.description, catId);
          }
          return this.msg.edited(this.txns.toView(updated, user.timezone));
        }
        default:
          return this.msg.error("not_yet");
      }
    } catch (err) {
      if (err instanceof AppError && err.code === "NOT_FOUND") return this.msg.error("not_found");
      logger.error({ err, action }, "postback failed");
      return this.msg.error("internal");
    }
  }
}
