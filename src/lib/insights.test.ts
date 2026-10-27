import { describe, expect, it } from "vitest";
import { averageBefore, categoryTrend, monthRange, monthTotals, perWeek, shopKey, spendByCategory, topShops } from "./insights";
import type { Transaction } from "./types";

let n = 0;
const tx = (date: string, amountCents: number, categoryId: string | null, counterparty = "Shop", transfer = false): Transaction => ({
  id: `t${n++}`, date, counterparty, amountCents, categoryId, source: "bank", accountId: null, description: null, transfer,
});

const txs: Transaction[] = [
  tx("2026-08-03", -10000, "food", "Albert Heijn 1342"),
  tx("2026-09-03", -20000, "food", "Albert Heijn 1342"),
  tx("2026-09-10", -5000, "out", "Brasserie"),
  tx("2026-10-01", -8000, "food", "Albert Heijn 1342"),
  tx("2026-10-02", -4000, "food", "ALBERT HEIJN 2211 UTRECHT"),
  tx("2026-10-03", -3000, "food", "Jumbo Leidsche Rijn"),
  tx("2026-10-04", -1500, null, "Kruidvat"),
  tx("2026-10-05", 300000, null, "Werkgever BV"),
  tx("2026-10-06", -50000, null, "Eigen spaarrekening", true),
];

describe("monthRange", () => {
  it("lists months oldest first across a year boundary", () => {
    expect(monthRange("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("monthTotals", () => {
  it("sums money out and in per month, skipping transfers", () => {
    expect(monthTotals(txs, ["2026-09", "2026-10"])).toEqual([
      { month: "2026-09", spentCents: 25000, incomeCents: 0 },
      { month: "2026-10", spentCents: 16500, incomeCents: 300000 },
    ]);
  });
});

describe("spendByCategory", () => {
  it("is largest first and keeps uncategorized as null", () => {
    expect(spendByCategory(txs, "2026-10")).toEqual([
      { categoryId: "food", spentCents: 15000 },
      { categoryId: null, spentCents: 1500 },
    ]);
  });
});

describe("categoryTrend", () => {
  it("gives a value for every month, zero when nothing was spent", () => {
    expect(categoryTrend(txs, "food", ["2026-07", "2026-08", "2026-09", "2026-10"])).toEqual([0, 10000, 20000, 15000]);
  });
});

describe("averageBefore", () => {
  const food = (m: string) => categoryTrend(txs, "food", [m])[0];
  it("averages only months with data", () => {
    // July has no transactions at all, so it does not pull the average down.
    expect(averageBefore(txs, "2026-10", 3, food)).toBe(15000);
  });
  it("is null without earlier data", () => {
    expect(averageBefore(txs, "2026-08", 3, food)).toBeNull();
  });
});

describe("shopKey", () => {
  it.each([
    ["Albert Heijn 1342", "albert heijn"],
    ["ALBERT HEIJN 2211 UTRECHT", "albert heijn"],
    ["Jumbo Leidsche Rijn", "jumbo leidsche rijn"],
    ["123 Bakkerij", "123 bakkerij"],
  ])("%s -> %s", (input, key) => {
    expect(shopKey(input)).toBe(key);
  });
});

describe("topShops", () => {
  it("groups branches of one shop", () => {
    expect(topShops(txs, "food", "2026-10", 5)).toEqual([
      { name: "Albert Heijn", spentCents: 12000, count: 2 },
      { name: "Jumbo Leidsche Rijn", spentCents: 3000, count: 1 },
    ]);
  });
  it("respects the limit", () => {
    expect(topShops(txs, "food", "2026-10", 1)).toHaveLength(1);
  });
});

describe("perWeek", () => {
  it("uses the days so far in the current month", () => {
    expect(perWeek(10000, "2026-10", "2026-10-07")).toBe(10000);
  });
  it("uses the whole month for a past month", () => {
    expect(perWeek(31000, "2026-10", "2026-11-15")).toBe(7000);
  });
});
