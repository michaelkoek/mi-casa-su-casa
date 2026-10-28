"use client";

import { ArrowDown, ArrowUp, CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import { averageBefore, categoryTrend, monthRange, monthTotals, perWeek, spendByCategory, topShops } from "@/lib/insights";
import { formatEuro, shiftMonth, toDateKey } from "@/lib/logic";
import { useHousehold, useNow } from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { PageHeader, Screen, SectionTitle } from "../screen";

/** Months in the trend charts, the selected month included. */
const TREND_MONTHS = 12;
/** Earlier months the "vs. gemiddeld" comparison looks at. */
const AVG_MONTHS = 3;

export function InsightsScreen() {
  return (
    <Screen>
      <Insights />
    </Screen>
  );
}

const monthName = (month: string, style: "long" | "short" | "narrow" = "long") =>
  new Date(`${month}-15T12:00:00`).toLocaleDateString("nl-NL", { month: style });

function Insights() {
  const t = useTranslations("insights");
  const { state } = useHousehold();
  const now = useNow();
  const today = toDateKey(now);
  const current = today.slice(0, 7);
  const [month, setMonth] = useState(current);
  const [openCat, setOpenCat] = useState<string | null | undefined>(undefined);
  const txs = state.transactions;

  const window12 = useMemo(() => monthRange(current, TREND_MONTHS), [current]);
  const totals = useMemo(() => monthTotals(txs, window12), [txs, window12]);
  const thisMonth = monthTotals(txs, [month])[0];
  const avg = averageBefore(txs, month, AVG_MONTHS, (m) => monthTotals(txs, [m])[0].spentCents);
  const categories = spendByCategory(txs, month);
  const maxCategory = Math.max(1, ...categories.map((c) => c.spentCents));
  const nameOf = (id: string | null) => (id === null ? t("uncategorized") : (state.categories.find((c) => c.id === id)?.name ?? id));
  const year = month.slice(0, 4) === current.slice(0, 4) ? "" : ` ${month.slice(0, 4)}`;

  const go = (n: number) => {
    setMonth((m) => shiftMonth(m, n));
    setOpenCat(undefined);
  };

  return (
    <>
      <Link href="/geld" transitionTypes={["nav-back"]} className="press -ml-2 mb-2 inline-flex h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-ink-2">
        <CaretLeft size={18} /> {t("back")}
      </Link>
      <PageHeader
        eyebrow={t("title")}
        title={`${monthName(month)}${year}`}
        action={
          <div className="flex gap-1.5">
            <button type="button" onClick={() => go(-1)} aria-label={t("prev")} className="press grid h-11 w-11 place-items-center rounded-full bg-surface">
              <CaretLeft size={18} />
            </button>
            <button type="button" onClick={() => go(1)} disabled={month >= current} aria-label={t("next")}
              className="press grid h-11 w-11 place-items-center rounded-full bg-surface disabled:opacity-40">
              <CaretRight size={18} />
            </button>
          </div>
        }
      />

      <section className="pop mt-4 rounded-[26px] bg-tile-money p-5">
        <p className="num text-4xl font-bold tracking-tight">{formatEuro(thisMonth.spentCents)}</p>
        <p className="mt-1 text-sm font-medium text-ink-2">{t("spent")}</p>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-2">
          {avg === null ? (
            t("noAvg")
          ) : (
            <>
              {thisMonth.spentCents > avg ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              {t(thisMonth.spentCents > avg ? "more" : "less", { amount: formatEuro(Math.abs(thisMonth.spentCents - avg), true) })}
            </>
          )}
        </p>
        {thisMonth.incomeCents > 0 && (
          <p className="mt-1 text-sm text-ink-2">{t("income", { amount: formatEuro(thisMonth.incomeCents, true) })}</p>
        )}
      </section>

      <SectionTitle>{t("perMonth")}</SectionTitle>
      <div className="rounded-[22px] bg-surface px-3 pb-2 pt-4">
        <MonthBars months={window12} values={totals.map((x) => x.spentCents)} selected={month}
          onSelect={(m) => { setMonth(m); setOpenCat(undefined); }} />
      </div>

      <SectionTitle>{t("byCategory")}</SectionTitle>
      {categories.length === 0 ? (
        <p className="rounded-[22px] bg-surface p-4 text-sm text-ink-2">{t("empty")}</p>
      ) : (
        <div className="rounded-[22px] bg-surface px-4 py-1">
          {categories.map((c) => {
            const open = openCat === c.categoryId;
            const catAvg = averageBefore(txs, month, AVG_MONTHS, (m) => categoryTrend(txs, c.categoryId, [m])[0]);
            const up = catAvg !== null && c.spentCents > catAvg;
            return (
              <div key={c.categoryId ?? "none"} className="border-b border-line last:border-b-0">
                <button type="button" aria-expanded={open} onClick={() => setOpenCat(open ? undefined : c.categoryId)} className="w-full py-3 text-left">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{nameOf(c.categoryId)}</span>
                    <span className="flex items-center gap-1.5">
                      {catAvg !== null && catAvg > 0 && (
                        <span className={clsx("flex items-center text-[12px]", up ? "text-bad" : "text-ink-3")}>
                          {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                          {Math.abs(Math.round(((c.spentCents - catAvg) / catAvg) * 100))}%
                        </span>
                      )}
                      <span className="num text-[13px] font-semibold">{formatEuro(c.spentCents, true)}</span>
                      <CaretDown size={14} className={clsx("text-ink-3 transition-transform duration-300", open && "rotate-180")} />
                    </span>
                  </span>
                  <span className="mt-2 block h-2 overflow-hidden rounded-full bg-bg">
                    <span className="block h-full origin-left rounded-full bg-ink transition-transform duration-300 ease-out"
                      style={{ transform: `scaleX(${c.spentCents / maxCategory})` }} />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                      <CategoryDetail txs={txs} categoryId={c.categoryId} month={month} months={window12} today={today}
                        spentCents={c.spentCents} avgCents={catAvg} onSelect={setMonth} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function CategoryDetail({
  txs, categoryId, month, months, today, spentCents, avgCents, onSelect,
}: {
  txs: Transaction[];
  categoryId: string | null;
  month: string;
  months: string[];
  today: string;
  spentCents: number;
  avgCents: number | null;
  onSelect: (m: string) => void;
}) {
  const t = useTranslations("insights");
  const shops = topShops(txs, categoryId, month, 5);
  return (
    <div className="pb-4">
      <p className="text-[13px] text-ink-3">
        {[t("perWeek", { amount: formatEuro(perWeek(spentCents, month, today), true) }),
          avgCents !== null ? t("avg", { amount: formatEuro(avgCents, true) }) : null].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-3">
        <MonthBars months={months} values={categoryTrend(txs, categoryId, months)} selected={month} onSelect={onSelect} small />
      </div>
      {shops.length > 0 && (
        <>
          <p className="mb-1 mt-3 text-[13px] font-semibold text-ink-3">{t("shops")}</p>
          <ul>
            {shops.map((s) => (
              <li key={s.name} className="flex justify-between gap-3 py-1.5 text-[13px]">
                <span className="min-w-0 truncate text-ink-2">
                  {s.name} <span className="text-ink-3">{t("times", { count: s.count })}</span>
                </span>
                <span className="num">{formatEuro(s.spentCents, true)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Column per month; the selected month in the accent colour. Tapping a column selects that month. */
function MonthBars({
  months, values, selected, onSelect, small = false,
}: {
  months: string[];
  values: number[];
  selected: string;
  onSelect: (m: string) => void;
  small?: boolean;
}) {
  const t = useTranslations("insights");
  const max = Math.max(1, ...values);
  return (
    <div className={clsx("grid items-end gap-1", small ? "h-20" : "h-32")} style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
      {months.map((m, i) => {
        const active = m === selected;
        return (
          <button key={m} type="button" onClick={() => onSelect(m)} aria-pressed={active}
            aria-label={t("monthLabel", { month: monthName(m), amount: formatEuro(values[i], true) })}
            className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
            <span className="flex w-full flex-1 items-end justify-center">
              <span
                className={clsx("block w-full max-w-5 origin-bottom rounded-t-md transition-transform duration-300 ease-out",
                  active ? "bg-accent" : "bg-ink/15", small ? "h-full" : "h-full")}
                style={{ transform: `scaleY(${Math.max(values[i] > 0 ? 0.03 : 0, values[i] / max)})` }}
              />
            </span>
            <span className={clsx("text-[11px] capitalize", active ? "font-semibold text-ink" : "text-ink-3")}>
              {monthName(m, "narrow")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
