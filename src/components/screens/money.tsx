"use client";

import { ArrowClockwise, Bank, CaretDown, Plus } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { categorizeTransaction, syncBank } from "@/lib/actions";
import { budgetSummary, formatEuro, formatTime, toDateKey } from "@/lib/logic";
import { useHousehold, useNow } from "@/lib/store";
import { SoftButton } from "../form";
import { PiggyArt } from "../illustrations";
import { Screen, SectionTitle } from "../screen";
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
  const { state, update } = useHousehold();
  const now = useNow();
  const { act, toast, openSheet } = useUI();
  const [remember, setRemember] = useState(true);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const month = toDateKey(now).slice(0, 7);
  const summary = budgetSummary(state.transactions, state.categories, month);
  const left = summary.totalBudgetCents - summary.totalSpentCents;
  const bank = state.bank;
  const consentDays = bank ? Math.round((new Date(bank.consentUntil).getTime() - now.getTime()) / 86400000) : null;
  const monthName = now.toLocaleDateString("nl-NL", { month: "long" });

  const sync = () => {
    setSyncing(true);
    window.setTimeout(() => {
      update(syncBank(new Date()));
      setSyncing(false);
      toast(t("synced"));
    }, 900);
  };

  return (
    <>
      <section className="pop relative overflow-hidden rounded-[26px] bg-tile-money p-5">
        <p className="relative z-10 text-[13px] font-medium capitalize text-ink-2">{monthName}</p>
        <p className="num relative z-10 mt-1 text-4xl font-bold tracking-tight">{formatEuro(summary.totalSpentCents)}</p>
        <p className={clsx("relative z-10 mt-1 text-sm font-medium", left < 0 ? "text-bad" : "text-ink-2")}>
          {left >= 0 ? t("under", { amount: formatEuro(left, true) }) : t("over", { amount: formatEuro(-left, true) })}
        </p>
        {bank && (
          <div className="relative z-10 mt-4 flex items-center gap-2 text-[13px] text-ink-2">
            <Bank size={18} />
            <span>{t("bankSynced", { bank: bank.name, time: formatTime(bank.syncedAt) })}</span>
            <button type="button" onClick={sync} disabled={syncing} aria-label={t("refresh")}
              className="press ml-auto grid h-10 w-10 place-items-center rounded-full bg-bg">
              <ArrowClockwise size={18} className={clsx(syncing && "animate-spin")} />
            </button>
          </div>
        )}
        <span className="pointer-events-none absolute -right-3 -top-1 opacity-90"><PiggyArt /></span>
      </section>
      {bank && consentDays !== null && consentDays <= 90 && (
        <p className="mt-2.5 px-1 text-[13px] text-ink-3">{t("consent", { days: consentDays, bank: bank.name })}</p>
      )}

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
      ) : (
        <div className="pop mt-5 rounded-[22px] bg-tile-agenda p-4 text-sm">{t("allSorted")}</div>
      )}

      <SectionTitle aside={t("tapForDetails")}>{t("budgets")}</SectionTitle>
      <div className="rounded-[22px] bg-surface px-4 py-1">
        {summary.lines.map((line) => {
          const open = openCat === line.category.id;
          const txs = state.transactions
            .filter((x) => x.categoryId === line.category.id && x.date.startsWith(month))
            .sort((a, b) => b.date.localeCompare(a.date));
          return (
            <div key={line.category.id} className="border-b border-line last:border-b-0">
              <button type="button" aria-expanded={open} onClick={() => setOpenCat(open ? null : line.category.id)} className="w-full py-3 text-left">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{line.category.name}</span>
                  <span className="flex items-center gap-1.5">
                    <span className={clsx("num text-[13px]", line.over ? "font-semibold text-bad" : "text-ink-3")}>
                      {formatEuro(line.spentCents, true)} / {formatEuro(line.category.budgetCents, true)}
                    </span>
                    <CaretDown size={14} className={clsx("text-ink-3 transition-transform duration-300", open && "rotate-180")} />
                  </span>
                </span>
                <span className="mt-2 block h-2 overflow-hidden rounded-full bg-bg">
                  <motion.span className={clsx("block h-full rounded-full", line.over ? "bg-accent" : "bg-ink")}
                    initial={false} animate={{ width: `${Math.min(100, Math.round(line.ratio * 100))}%` }}
                    transition={{ type: "spring", stiffness: 200, damping: 30 }} />
                </span>
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
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <SoftButton className="mt-3 w-full" onClick={() => openSheet("expense")}>
        <Plus size={18} weight="bold" /> {t("addCash")}
      </SoftButton>
    </>
  );
}
