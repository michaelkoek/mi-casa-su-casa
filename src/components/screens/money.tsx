"use client";

import { CaretDown, CaretRight, ChartBar, ListBullets, Plus, type Icon } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { categorizeTransaction } from "@/lib/actions";
import { budgetSummary, formatEuro, toDateKey } from "@/lib/logic";
import { useHousehold, useNow } from "@/lib/store";
import type { Category } from "@/lib/types";
import { BankStrip } from "../bank";
import { SoftButton } from "../form";
import { CategoryForm } from "../money-forms";
import { PiggyArt } from "../illustrations";
import { Screen, SectionTitle } from "../screen";
import { Sheet } from "../sheet";
import { useUI } from "../ui-provider";

export function MoneyScreen() {
  return (
    <Screen>
      <Money />
    </Screen>
  );
}

function Money() {
  const t = useTranslations("money");
  const { state } = useHousehold();
  const now = useNow();
  const { act, openSheet } = useUI();
  const [remember, setRemember] = useState(true);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [catId, setCatId] = useState<string | "new" | null>(null);
  // Separate from catId so the sheet keeps its content while it slides away.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const month = toDateKey(now).slice(0, 7);
  const summary = budgetSummary(state.transactions, state.categories, month);
  const left = summary.totalBudgetCents - summary.budgetedSpentCents;
  const monthName = now.toLocaleDateString("nl-NL", { month: "long" });

  const isNew = catId === "new";
  const editing = isNew ? null : (state.categories.find((c) => c.id === catId) ?? null);
  // Deleted (by us or the other member): close for good, so an undo doesn't reopen the sheet.
  if (sheetOpen && !isNew && editing === null) setSheetOpen(false);
  const openCategory = (id: string | "new") => {
    setCatId(id);
    setFormKey((k) => k + 1);
    setSheetOpen(true);
  };

  const monthCount = state.transactions.filter((x) => x.date.startsWith(month)).length;

  return (
    <>
      <section className="pop relative overflow-hidden rounded-[26px] bg-tile-money p-5">
        <p className="relative z-10 text-[13px] font-medium capitalize text-ink-2">{monthName}</p>
        <p className="num relative z-10 mt-1 text-4xl font-bold tracking-tight">{formatEuro(summary.totalSpentCents)}</p>
        <p className={clsx("relative z-10 mt-1 text-sm font-medium", summary.hasBudget && left < 0 ? "text-bad" : "text-ink-2")}>
          {!summary.hasBudget
            ? t("spentOnly")
            : left >= 0 ? t("under", { amount: formatEuro(left, true) }) : t("over", { amount: formatEuro(-left, true) })}
        </p>
        <span className="pointer-events-none absolute -right-3 -top-1 opacity-90"><PiggyArt /></span>
      </section>
      <BankStrip />

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <NavTile href="/geld/inzicht" Icon={ChartBar} title={t("insights")} sub={t("insightsSub")} />
        <NavTile href="/geld/transacties" Icon={ListBullets} title={t("transactions")} sub={t("transactionsSub", { count: monthCount })} />
      </div>

      {summary.uncategorized.length > 0 ? (
        <>
          <SectionTitle aside={summary.uncategorized.length}>{t("inbox")}</SectionTitle>
          <div className="rounded-[22px] bg-surface px-4">
            <AnimatePresence initial={false}>
              {summary.uncategorized.map((tx) => (
                <motion.div key={tx.id} layout exit={{ opacity: 0, x: 28, height: 0, paddingTop: 0, paddingBottom: 0 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden border-b border-line py-3.5 last:border-b-0">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">{tx.counterparty}</span>
                    <span className="num">{formatEuro(tx.amountCents)}</span>
                  </div>
                  <div className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
                    {state.categories.map((c) => (
                      <button key={c.id} type="button"
                        onClick={() => act(t("categorized", { name: tx.counterparty, category: c.name }), categorizeTransaction(tx.id, c.id, remember))}
                        className="press h-9 flex-none rounded-full bg-bg px-3.5 text-[13px] font-medium">
                        {c.name}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <label className="mt-2.5 flex min-h-11 items-center gap-3 px-1 text-sm text-ink-2">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-[var(--accent-strong)]" />
            {t("remember")}
          </label>
        </>
      ) : state.transactions.length > 0 ? (
        <div className="pop mt-5 rounded-[22px] bg-tile-agenda p-4 text-sm">{t("allSorted")}</div>
      ) : (
        <div className="pop mt-5 rounded-[22px] bg-surface p-4 text-sm text-ink-2">
          {t(state.bank.length > 0 ? "emptyLinked" : "emptyNoBank")}
        </div>
      )}

      <SectionTitle aside={t("tapForDetails")}>{t("budgets")}</SectionTitle>
      <div className="rounded-[22px] bg-surface px-4 py-1">
        {summary.lines.map((line) => {
          const open = openCat === line.category.id;
          const budget = line.category.budgetCents;
          const txs = state.transactions
            .filter((x) => x.categoryId === line.category.id && x.date.startsWith(month))
            .sort((a, b) => b.date.localeCompare(a.date));
          return (
            <div key={line.category.id} className="border-b border-line last:border-b-0">
              <button type="button" aria-expanded={open} onClick={() => setOpenCat(open ? null : line.category.id)} className="w-full py-3 text-left">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{line.category.name}</span>
                  <span className="flex items-center gap-1.5">
                    {budget !== null ? (
                      <span className={clsx("num text-[13px]", line.over ? "font-semibold text-bad" : "text-ink-3")}>
                        {formatEuro(line.spentCents, true)} / {formatEuro(budget, true)}
                      </span>
                    ) : (
                      <span className="num text-[13px] text-ink-3">{formatEuro(line.spentCents, true)}</span>
                    )}
                    <CaretDown size={14} className={clsx("text-ink-3 transition-transform duration-300", open && "rotate-180")} />
                  </span>
                </span>
                {budget !== null && (
                  <span className="mt-2 block h-2 overflow-hidden rounded-full bg-bg">
                    <motion.span className={clsx("block h-full rounded-full", line.over ? "bg-accent" : "bg-ink")}
                      initial={false} animate={{ width: `${Math.min(100, Math.round(line.ratio * 100))}%` }}
                      transition={{ type: "spring", stiffness: 200, damping: 30 }} />
                  </span>
                )}
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                    {txs.length === 0 && <li className="pb-3 text-[13px] text-ink-3">{t("noTransactions")}</li>}
                    {txs.map((x) => (
                      <li key={x.id} className="flex justify-between gap-3 pb-2.5 text-[13px]">
                        <span className="text-ink-2">
                          {new Date(x.date + "T12:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} · {x.counterparty}
                          {x.source === "manual" && <span className="ml-1.5 rounded-full bg-bg px-1.5 py-0.5 text-[11px]">{t("manual")}</span>}
                        </span>
                        <span className="num">{formatEuro(x.amountCents)}</span>
                      </li>
                    ))}
                    <li className="pb-3">
                      <button type="button" onClick={() => openCategory(line.category.id)}
                        className="press flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-bg px-4 text-sm">
                        <span className="text-ink-2">
                          {budget !== null ? t("budget.line", { amount: formatEuro(budget, true) }) : t("budget.none")}
                        </span>
                        <span className="font-semibold">{budget !== null ? t("budget.edit") : t("budget.set")}</span>
                      </button>
                    </li>
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        <button type="button" onClick={() => openCategory("new")}
          className="press flex min-h-12 w-full items-center gap-2 border-b border-line py-3 text-sm font-semibold text-ink-2">
          <Plus size={18} weight="bold" /> {t("addCategory")}
        </button>
        <Link href="/geld/regels" transitionTypes={["nav-forward"]}
          className="press flex min-h-12 items-center justify-between py-3 text-sm font-semibold text-ink-2">
          {t("rulesLink", { count: state.rules.length })}
          <CaretRight size={18} className="text-ink-3" />
        </Link>
      </div>

      <CategorySheet category={editing} isNew={isNew}
        spentCents={summary.lines.find((l) => l.category.id === catId)?.spentCents ?? 0}
        open={sheetOpen} formKey={formKey} onClose={() => setSheetOpen(false)} />

      <SoftButton className="mt-3 w-full" onClick={() => openSheet("expense")}>
        <Plus size={18} weight="bold" /> {t("addCash")}
      </SoftButton>
    </>
  );
}

function NavTile({ href, Icon, title, sub }: { href: string; Icon: Icon; title: string; sub: string }) {
  return (
    <Link href={href} transitionTypes={["nav-forward"]}
      className="press flex min-h-[104px] flex-col justify-between rounded-[22px] bg-surface p-4">
      <Icon size={22} />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{sub}</span>
      </span>
    </Link>
  );
}

/** Add or edit one category: name, monthly budget, delete. */
function CategorySheet({ category, isNew, spentCents, open, formKey, onClose }: {
  category: Category | null; isNew: boolean; spentCents: number; open: boolean; formKey: number; onClose: () => void;
}) {
  const t = useTranslations("money.category");
  const visible = isNew || category !== null;
  return (
    <Sheet open={open && visible} onClose={onClose} title={isNew ? t("newTitle") : t("editTitle")}>
      {visible && <CategoryForm key={formKey} item={isNew ? null : category} spentCents={spentCents} onDone={onClose} />}
    </Sheet>
  );
}
