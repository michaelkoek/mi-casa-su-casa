import { describe, expect, it } from "vitest";
import {
  addDays,
  budgetSummary,
  categorize,
  completeChore,
  doseProgress,
  findRecipeByName,
  formatDuration,
  missingIngredients,
  nextAssignee,
  nextDoseAllowedAt,
  normalizeItem,
  parseEuroToCents,
  parseIngredients,
  suggestMeals,
} from "./logic";
import { createSeed } from "./seed";
import type { Recipe, ShoppingItem } from "./types";
import type { Category, Chore, Dose, Medicine, Transaction } from "./types";

const paracetamol: Medicine = { id: "para", name: "Paracetamol", intervalHours: 6 };

describe("nextDoseAllowedAt", () => {
  it("returns null without doses", () => {
    expect(nextDoseAllowedAt([], paracetamol)).toBeNull();
  });

  it("uses the latest dose of that medicine only", () => {
    const doses: Dose[] = [
      { id: "1", medicineId: "para", amount: "120 mg", at: "2026-10-24T08:00:00.000Z", by: "m1" },
      { id: "2", medicineId: "para", amount: "120 mg", at: "2026-10-24T14:10:00.000Z", by: "m2" },
      { id: "3", medicineId: "ibu", amount: "50 mg", at: "2026-10-24T16:00:00.000Z", by: "m1" },
    ];
    expect(nextDoseAllowedAt(doses, paracetamol)?.toISOString()).toBe("2026-10-24T20:10:00.000Z");
  });

  it("reports progress between doses", () => {
    const doses: Dose[] = [{ id: "1", medicineId: "para", amount: "", at: "2026-10-24T12:00:00.000Z", by: "m1" }];
    expect(doseProgress(doses, paracetamol, new Date("2026-10-24T15:00:00.000Z"))).toBeCloseTo(0.5);
    expect(doseProgress(doses, paracetamol, new Date("2026-10-24T19:00:00.000Z"))).toBe(1);
  });
});

describe("chores", () => {
  const chore: Chore = { id: "c", title: "Stofzuigen", intervalDays: 7, rotation: ["m1", "m2"], nextDue: "2026-10-26" };

  it("knows who is next", () => {
    expect(nextAssignee(chore)).toBe("m1");
  });

  it("rotates and reschedules on completion", () => {
    const done = completeChore(chore, "2026-10-26");
    expect(nextAssignee(done)).toBe("m2");
    expect(done.nextDue).toBe("2026-11-02");
  });
});

describe("categorize", () => {
  const rules = [
    { id: "r1", contains: "albert heijn", categoryId: "food" },
    { id: "r2", contains: "NS", categoryId: "transport" },
  ];
  it("matches case-insensitively", () => {
    expect(categorize({ counterparty: "ALBERT HEIJN 1234 UTRECHT" }, rules)).toBe("food");
  });
  it("returns null when nothing matches", () => {
    expect(categorize({ counterparty: "Gamma Utrecht" }, rules)).toBeNull();
  });
  it("falls back to the payment details", () => {
    expect(categorize({ counterparty: "CCV*Betaling", description: "Albert Heijn 1342 Utrecht" }, rules)).toBe("food");
  });
  it("prefers a counterparty match over a details match", () => {
    const both = [...rules, { id: "r3", contains: "bakker", categoryId: "out" }];
    expect(categorize({ counterparty: "Bakker Bart", description: "albert heijn" }, both)).toBe("out");
  });
});

describe("budgetSummary", () => {
  const categories: Category[] = [
    { id: "food", name: "Boodschappen", budgetCents: 45000 },
    { id: "home", name: "Huis", budgetCents: 20000 },
  ];
  const tx: Transaction[] = [
    { id: "1", date: "2026-10-02", counterparty: "AH", amountCents: -12000, categoryId: "food", source: "bank", accountId: null, description: null, transfer: false },
    { id: "2", date: "2026-10-03", counterparty: "Gamma", amountCents: -24100, categoryId: "home", source: "bank", accountId: null, description: null, transfer: false },
    { id: "3", date: "2026-10-04", counterparty: "Salaris", amountCents: 300000, categoryId: null, source: "bank", accountId: null, description: null, transfer: false },
    { id: "4", date: "2026-09-30", counterparty: "AH", amountCents: -5000, categoryId: "food", source: "bank", accountId: null, description: null, transfer: false },
    { id: "5", date: "2026-10-05", counterparty: "Kruidvat", amountCents: -1849, categoryId: null, source: "bank", accountId: null, description: null, transfer: false },
    { id: "6", date: "2026-10-06", counterparty: "Eigen spaarrekening", amountCents: -50000, categoryId: null, source: "bank", accountId: null, description: null, transfer: true },
  ];
  it("sums spending per category for the month and flags overspending", () => {
    const s = budgetSummary(tx, categories, "2026-10");
    expect(s.lines[0].spentCents).toBe(12000);
    expect(s.lines[1].over).toBe(true);
    expect(s.totalSpentCents).toBe(12000 + 24100 + 1849);
    expect(s.uncategorized.map((t) => t.id)).toEqual(["5"]);
  });
  it("skips transfers between own accounts", () => {
    const s = budgetSummary(tx, categories, "2026-10");
    expect(s.uncategorized.map((t) => t.id)).not.toContain("6");
    expect(s.totalSpentCents).toBe(12000 + 24100 + 1849);
  });
});

describe("parseEuroToCents", () => {
  it.each([
    ["12,50", 1250],
    ["12.5", 1250],
    ["€ 7", 700],
    ["1.234,56", 123456],
  ])("parses %s", (input, cents) => {
    expect(parseEuroToCents(input)).toBe(cents);
  });
  it.each(["", "abc", "0", "-5", "1,234"])("rejects %s", (input) => {
    expect(parseEuroToCents(input)).toBeNull();
  });
});

describe("helpers", () => {
  it("adds days across months", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });
  it("formats durations", () => {
    expect(formatDuration(160 * 60000)).toBe("2 u 40 min");
    expect(formatDuration(15 * 60000)).toBe("15 min");
    expect(formatDuration(-5)).toBe("0 min");
  });
});

describe("shopping logic", () => {
  const seed = createSeed(new Date("2026-10-24T14:00:00"));
  const item = (name: string, checked: boolean): ShoppingItem => ({ id: name, name, checked, source: "manual" });
  const recipe = (name: string, ingredients: string[]): Recipe => ({ id: name, name, ingredients });

  it("normalizes names", () => {
    expect(normalizeItem("  Melk ")).toBe("melk");
  });

  it("parses ingredients", () => {
    expect(parseIngredients("Pasta, tomaat\n basilicum,,pasta ")).toEqual(["Pasta", "tomaat", "basilicum"]);
    expect(parseIngredients("x".repeat(120))[0]).toHaveLength(100);
    expect(parseIngredients(Array.from({ length: 60 }, (_, i) => `n${i}`).join(","))).toHaveLength(50);
  });

  it("finds a recipe by name", () => {
    expect(findRecipeByName(seed.recipes, "  linzensoep ")?.id).toBe("rc3");
    expect(findRecipeByName(seed.recipes, "")).toBeUndefined();
  });

  it("lists ingredients that are not in huis", () => {
    expect(missingIngredients(["Penne", "Salie"], seed.shopping)).toEqual(["Salie"]);
    expect(missingIngredients(["Melk"], [item("melk", false)])).toEqual(["Melk"]);
  });

  it("ranks suggestions", () => {
    const shopping = ["a", "b", "c", "d"].map((n) => item(n, true));
    const out = suggestMeals(
      [
        recipe("Leeg", []),
        recipe("Half", ["a", "x"]),
        recipe("Vier van vijf", ["a", "b", "c", "d", "e"]),
        recipe("Compleet", ["a", "b"]),
        recipe("Bijna", ["a", "b", "x"]),
        recipe("Aaa half", ["a", "y"]),
      ],
      shopping,
    );
    expect(out.map((s) => s.recipe.name)).toEqual(["Compleet", "Vier van vijf", "Bijna", "Aaa half", "Half"]);
    const four = out.find((s) => s.recipe.name === "Vier van vijf")!;
    expect(four.have).toEqual(["a", "b", "c", "d"]);
    expect(four.missing).toEqual(["e"]);
    expect(four.score).toBeCloseTo(0.8);
  });
});
