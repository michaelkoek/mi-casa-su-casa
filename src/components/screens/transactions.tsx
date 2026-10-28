"use client";

import { ArrowsLeftRight, CaretLeft, MagnifyingGlass } from "@phosphor-icons/react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import { categorizeTransaction, setTransfer } from "@/lib/actions";
import { addDays, formatEuro, toDateKey } from "@/lib/logic";
import { useHousehold, useNow } from "@/lib/store";
import type { HouseholdState, Transaction } from "@/lib/types";
import { Checkbox } from "../form";
import { PageHeader, Screen } from "../screen";
import { Sheet } from "../sheet";
import { useUI } from "../ui-provider";

/** Rows rendered at first; more on demand, so a year of bank data stays fast on a phone. */
const PAGE = 120;

type Filter = { kind: "all" } | { kind: "uncategorized" } | { kind: "category"; id: string } | { kind: "account"; id: string };

export function TransactionsScreen() {
  return (
    <Screen>
      <Transactions />
    </Screen>
  );
}

/** "Bank · rekening" per account id, for the small label under each row. */
export function accountLabels(state: HouseholdState): Map<string, string> {
  const labels = new Map<string, string>();
  for (const bank of state.bank) {
    for (const a of bank.accounts) {
      labels.set(a.id, bank.accounts.length > 1 && a.name ? `${bank.name} · ${a.name}` : bank.name);
    }
  }
  return labels;
}

function matches(tx: Transaction, filter: Filter, q: string): boolean {
  if (filter.kind === "uncategorized" && (tx.categoryId !== null || tx.transfer || tx.amountCents >= 0)) return false;
  if (filter.kind === "category" && tx.categoryId !== filter.id) return false;
  if (filter.kind === "account" && tx.accountId !== filter.id) return false;
  if (!q) return true;
  return tx.counterparty.toLowerCase().includes(q) || (tx.description ?? "").toLowerCase().includes(q);
}

function Transactions() {
  const t = useTranslations("transactions");
  const { state } = useHousehold();
  const now = useNow();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);
  // Separate from openId so the sheet keeps its content while it slides away.
  const [sheetOpen, setSheetOpen] = useState(false);

  const labels = useMemo(() => accountLabels(state), [state]);
  const categoryName = useMemo(() => new Map(state.categories.map((c) => [c.id, c.name])), [state.categories]);
  const q = query.trim().toLowerCase();
  const list = useMemo(
    () => state.transactions.filter((tx) => matches(tx, filter, q)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [state.transactions, filter, q],
  );
  const shown = list.slice(0, limit);
  const days = groupByDay(shown);
  const today = toDateKey(now);
  const open = state.transactions.find((x) => x.id === openId) ?? null;

  const dayLabel = (date: string) =>
    date === today
      ? t("today")
      : date === addDays(today, -1)
        ? t("yesterday")
        : new Date(`${date}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "long" });

  const chips: { key: string; label: string; filter: Filter }[] = [
    { key: "all", label: t("all"), filter: { kind: "all" } },
    { key: "uncategorized", label: t("uncategorized"), filter: { kind: "uncategorized" } },
    ...state.categories.map((c) => ({ key: `c:${c.id}`, label: c.name, filter: { kind: "category", id: c.id } as Filter })),
    ...(labels.size > 1
      ? [...labels].map(([id, label]) => ({ key: `a:${id}`, label, filter: { kind: "account", id } as Filter }))
      : []),
  ];
  const activeKey =
    filter.kind === "category" ? `c:${filter.id}` : filter.kind === "account" ? `a:${filter.id}` : filter.kind;

  return (
    <>
      <Link href="/geld" transitionTypes={["nav-back"]} className="press -ml-2 mb-2 inline-flex h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-ink-2">
        <CaretLeft size={18} /> {t("back")}
      </Link>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />

      <label className="mt-4 flex h-12 items-center gap-2 rounded-2xl bg-surface px-3.5">
        <MagnifyingGlass size={18} className="text-ink-3" />
        <input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder={t("search")} aria-label={t("search")}
          type="search" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3" />
      </label>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
        {chips.map((c) => (
          <button key={c.key} type="button" aria-pressed={activeKey === c.key}
            onClick={() => { setFilter(c.filter); setLimit(PAGE); }}
            className={clsx("press h-9 flex-none rounded-full px-3.5 text-[13px] font-medium",
              activeKey === c.key ? "bg-ink text-bg" : "bg-surface text-ink-2")}>
            {c.label}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <p className="mt-6 rounded-[22px] bg-surface p-4 text-sm text-ink-2">
          {state.transactions.length === 0 ? t("emptyAll") : t("empty")}
        </p>
      )}

      {days.map(([date, txs]) => (
        <section key={date}>
          <h2 className="mx-0.5 mb-2 mt-6 text-[13px] font-semibold capitalize text-ink-3">{dayLabel(date)}</h2>
          <ul className="rounded-[22px] bg-surface px-4">
            {txs.map((tx) => (
              <li key={tx.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => { setOpenId(tx.id); setSheetOpen(true); }} className="flex min-h-14 w-full items-center gap-3 py-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{tx.counterparty}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-ink-3">
                      {[
                        tx.transfer ? t("transfer") : tx.categoryId ? categoryName.get(tx.categoryId) : tx.amountCents < 0 ? t("uncategorized") : null,
                        tx.accountId ? labels.get(tx.accountId) : tx.source === "manual" ? t("manual") : null,
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={clsx("num flex-none", tx.amountCents > 0 && "font-semibold", tx.transfer && "text-ink-3")}>
                    {tx.amountCents > 0 ? `+ ${formatEuro(tx.amountCents)}` : formatEuro(tx.amountCents)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {list.length > limit && (
        <button type="button" onClick={() => setLimit((n) => n + PAGE)}
          className="press mt-4 h-12 w-full rounded-2xl bg-surface text-sm font-semibold">
          {t("more")}
        </button>
      )}

      <TransactionSheet tx={open} open={sheetOpen} account={open?.accountId ? labels.get(open.accountId) : undefined}
        onClose={() => setSheetOpen(false)} />
    </>
  );
}

function groupByDay(txs: Transaction[]): [string, Transaction[]][] {
  const days = new Map<string, Transaction[]>();
  for (const tx of txs) days.set(tx.date, [...(days.get(tx.date) ?? []), tx]);
  return [...days];
}

/** Detail of one transaction: pick its category (optionally as a rule) or mark it as an own transfer. */
function TransactionSheet({ tx, open, account, onClose }: { tx: Transaction | null; open: boolean; account?: string; onClose: () => void }) {
  const t = useTranslations("transactions");
  const { state } = useHousehold();
  const { act } = useUI();
  const [remember, setRemember] = useState(true);

  return (
    <Sheet open={open && tx !== null} onClose={onClose} title={tx?.counterparty ?? ""}>
      {tx && (
        <>
          <p className="mt-1 text-[13px] text-ink-3">
            {new Date(`${tx.date}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h2 className="mt-1 text-xl font-bold">{tx.counterparty}</h2>
          <p className={clsx("num mt-1 text-3xl font-bold tracking-tight", tx.transfer && "text-ink-3")}>
            {tx.amountCents > 0 ? `+ ${formatEuro(tx.amountCents)}` : formatEuro(tx.amountCents)}
          </p>

          {(tx.description || account) && (
            <dl className="mt-4 rounded-[22px] bg-surface px-4 py-1 text-sm">
              {tx.description && (
                <div className="border-b border-line py-3 last:border-b-0">
                  <dt className="text-[13px] text-ink-3">{t("details")}</dt>
                  <dd className="mt-0.5 break-words">{tx.description}</dd>
                </div>
              )}
              {account && (
                <div className="border-b border-line py-3 last:border-b-0">
                  <dt className="text-[13px] text-ink-3">{t("account")}</dt>
                  <dd className="mt-0.5">{account}</dd>
                </div>
              )}
            </dl>
          )}

          {!tx.transfer && (
            <>
              <p className="mb-2 mt-5 text-[13px] font-semibold text-ink-3">{t("category")}</p>
              <div className="flex flex-wrap gap-2">
                {state.categories.map((c) => (
                  <button key={c.id} type="button" aria-pressed={tx.categoryId === c.id}
                    onClick={() => {
                      act(t("categorized", { name: tx.counterparty, category: c.name }), categorizeTransaction(tx.id, c.id, remember));
                      onClose();
                    }}
                    className={clsx("press h-10 rounded-full px-4 text-sm font-medium",
                      tx.categoryId === c.id ? "bg-ink text-bg" : "bg-surface")}>
                    {c.name}
                  </button>
                ))}
              </div>
              <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-ink-2">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-[var(--accent-strong)]" />
                {t("remember", { name: tx.counterparty })}
              </label>
            </>
          )}

          <button type="button" role="switch" aria-checked={tx.transfer}
            onClick={() => act(t(tx.transfer ? "transferOff" : "transferOn", { name: tx.counterparty }), setTransfer(tx.id, !tx.transfer))}
            className="press mt-4 flex w-full items-center gap-3 rounded-[22px] bg-surface p-4 text-left">
            <ArrowsLeftRight size={20} className="flex-none" />
            <span className="flex-1">
              <span className="block font-medium">{t("markTransfer")}</span>
              <span className="block text-[13px] text-ink-3">{t("markTransferSub")}</span>
            </span>
            <Checkbox done={tx.transfer} />
          </button>
        </>
      )}
    </Sheet>
  );
}
