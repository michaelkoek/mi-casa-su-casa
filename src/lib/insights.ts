import { isSpending, shiftMonth } from "./logic";
import type { Transaction } from "./types";

/* Spending patterns for the Inzicht screen. Pure; amounts in cents, months as "YYYY-MM". */

/** `count` month keys ending at (and including) `end`, oldest first. */
export function monthRange(end: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(end, i - count + 1));
}

const monthOf = (t: Transaction) => t.date.slice(0, 7);

export type MonthTotal = { month: string; spentCents: number; incomeCents: number };

/** Money out and money in per month; transfers between own accounts count as neither. */
export function monthTotals(txs: Transaction[], months: string[]): MonthTotal[] {
  const totals = new Map(months.map((m) => [m, { month: m, spentCents: 0, incomeCents: 0 }]));
  for (const t of txs) {
    const row = totals.get(monthOf(t));
    if (!row || t.transfer) continue;
    if (t.amountCents < 0) row.spentCents -= t.amountCents;
    else row.incomeCents += t.amountCents;
  }
  return months.map((m) => totals.get(m)!);
}

export type CategorySpend = { categoryId: string | null; spentCents: number };

/** Spending per category in one month, largest first; uncategorized spending has categoryId null. */
export function spendByCategory(txs: Transaction[], month: string): CategorySpend[] {
  const sums = new Map<string | null, number>();
  for (const t of txs) {
    if (monthOf(t) !== month || !isSpending(t)) continue;
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) - t.amountCents);
  }
  return [...sums]
    .map(([categoryId, spentCents]) => ({ categoryId, spentCents }))
    .sort((a, b) => b.spentCents - a.spentCents);
}

/** Spending in one category (null = uncategorized) for each month. */
export function categoryTrend(txs: Transaction[], categoryId: string | null, months: string[]): number[] {
  const sums = new Map(months.map((m) => [m, 0]));
  for (const t of txs) {
    const m = monthOf(t);
    if (t.categoryId !== categoryId || !isSpending(t) || !sums.has(m)) continue;
    sums.set(m, sums.get(m)! - t.amountCents);
  }
  return months.map((m) => sums.get(m)!);
}

/**
 * Average of the `back` months before `month`, counting only months that have any
 * transaction at all: a month before the bank was linked is unknown, not zero.
 * Null when there is no such month.
 */
export function averageBefore(txs: Transaction[], month: string, back: number, value: (m: string) => number): number | null {
  const known = new Set(txs.map(monthOf));
  const months = monthRange(shiftMonth(month, -1), back).filter((m) => known.has(m));
  if (months.length === 0) return null;
  return Math.round(months.reduce((sum, m) => sum + value(m), 0) / months.length);
}

/** Groups "Albert Heijn 1342" and "ALBERT HEIJN 2211 UTRECHT" as one shop: the text before the first digit. */
export function shopKey(counterparty: string): string {
  const head = counterparty.split(/\d/)[0].replace(/[\s*,.\-/]+$/, "").trim();
  return (head || counterparty).toLowerCase().replace(/\s+/g, " ");
}

export type Shop = { name: string; spentCents: number; count: number };

/** Where the money in one category went this month, largest first. */
export function topShops(txs: Transaction[], categoryId: string | null, month: string, limit: number): Shop[] {
  const shops = new Map<string, Shop>();
  for (const t of txs) {
    if (monthOf(t) !== month || t.categoryId !== categoryId || !isSpending(t)) continue;
    const key = shopKey(t.counterparty);
    const shop = shops.get(key) ?? {
      name: t.counterparty.split(/\d/)[0].trim() || t.counterparty,
      spentCents: 0,
      count: 0,
    };
    shop.spentCents -= t.amountCents;
    shop.count += 1;
    shops.set(key, shop);
  }
  return [...shops.values()].sort((a, b) => b.spentCents - a.spentCents).slice(0, limit);
}

/** Average spending per week in a month; for the current month only the days so far count. */
export function perWeek(spentCents: number, month: string, today: string): number {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = today.startsWith(month) ? Number(today.slice(8, 10)) : daysInMonth;
  return Math.round((spentCents * 7) / days);
}
