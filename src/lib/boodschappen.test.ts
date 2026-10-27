import { describe, expect, it } from "vitest";
import { cycleStock, materialsToShopping, missingToShopping, needItems, planDay, saveRecipe } from "./actions";
import { cleanNames, parseIngredients, suggestMeals } from "./logic";
import { buildMealPrompt, parseMealIdeas } from "./meal-ideas";
import { createSeed } from "./seed";
import { diffState } from "./sync/diff";
import { parseChangeset } from "./sync/schema";

const now = new Date("2026-10-24T14:00:00");
const seed = createSeed(now);
const cs = (...changes: unknown[]) => ({ id: crypto.randomUUID(), changes });

describe("cleanNames / parseIngredients edge cases", () => {
  it("handles empty input and whitespace-only entries", () => {
    expect(cleanNames([])).toEqual([]);
    expect(cleanNames(["  ", "", "\t"])).toEqual([]);
    expect(parseIngredients("")).toEqual([]);
    expect(parseIngredients(" , \n ,")).toEqual([]);
  });

  it("keeps the first spelling and respects max", () => {
    expect(cleanNames(["Melk", "MELK", "melk "])).toEqual(["Melk"]);
    expect(cleanNames(["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });
});

describe("suggestMeals", () => {
  it("returns an empty list without recipes or without ingredients", () => {
    expect(suggestMeals([], seed.shopping)).toEqual([]);
    expect(suggestMeals([{ id: "x", name: "Leeg", ingredients: [] }], seed.shopping)).toEqual([]);
  });

  it("scores 0 when nothing is in huis", () => {
    const out = suggestMeals([{ id: "x", name: "Soep", ingredients: ["Ui"] }], []);
    expect(out[0]).toMatchObject({ have: [], missing: ["Ui"], score: 0 });
  });
});

describe("shopping updaters, extra", () => {
  it("needItems ignores blank names and returns the same state", () => {
    expect(needItems(["", "   "], "manual")(seed)).toBe(seed);
  });

  it("needItems matches case-insensitively and only unchecks the matching item", () => {
    const next = needItems(["PENNE"], "manual")(seed);
    const changed = next.shopping.filter((i, idx) => i !== seed.shopping[idx]);
    expect(changed.map((i) => i.id)).toEqual(["s3"]);
  });

  it("missingToShopping with everything in huis changes nothing", () => {
    expect(missingToShopping(["Penne"])(seed)).toBe(seed);
  });

  it("materialsToShopping puts an unknown project on no list", () => {
    expect(materialsToShopping("nope")(seed)).toBe(seed);
  });

  it("cycleStock reaching low puts the item on halen once, also when it was in huis", () => {
    const withStock = { ...seed, stock: [{ id: "stx", name: "Penne", level: "half" as const }], shopping: seed.shopping };
    const next = cycleStock("stx")(withStock);
    expect(next.stock[0].level).toBe("low");
    expect(next.shopping.filter((i) => i.name.toLowerCase() === "penne")).toHaveLength(1);
    expect(next.shopping.find((i) => i.name === "Penne")?.checked).toBe(false);
  });

  it("saveRecipe truncates the name to 100 chars and dedupes ingredients", () => {
    const next = saveRecipe("x".repeat(150), ["a", "A", "b"], "rc9")(seed);
    const r = next.recipes.at(-1)!;
    expect(r.name).toHaveLength(100);
    expect(r.ingredients).toEqual(["a", "b"]);
  });

  it("planDay reuses an existing recipe id and updates its ingredients", () => {
    const date = seed.mealPlan[0].date;
    const next = planDay(date, { title: "linzensoep", ingredients: ["Linzen", "Wortel"], cookId: "m1" })(seed);
    expect(next.recipes).toHaveLength(seed.recipes.length);
    expect(next.recipes.find((r) => r.id === "rc3")?.ingredients).toEqual(["Linzen", "Wortel"]);
    expect(next.mealPlan.find((m) => m.date === date)?.recipeId).toBe("rc3");
  });

  it("planDay without ingredients links an existing recipe by name", () => {
    const date = seed.mealPlan[0].date;
    const next = planDay(date, { title: "Linzensoep", ingredients: [], cookId: "m1" })(seed);
    expect(next.mealPlan.find((m) => m.date === date)?.recipeId).toBe("rc3");
  });

  it("planDay changeset passes the sync schema and so does its undo", () => {
    const date = seed.mealPlan[0].date;
    const next = planDay(date, { title: "Shakshuka", ingredients: ["Eieren", "Tomaat"], cookId: "m1" })(seed);
    for (const changes of [diffState(seed, next), diffState(next, seed)]) {
      expect(changes.length).toBeGreaterThan(0);
      expect(parseChangeset({ id: crypto.randomUUID(), changes }).ok).toBe(true);
    }
  });
});

describe("parseMealIdeas, extra malformed input", () => {
  it("returns null for empty, truncated and wrongly typed JSON", () => {
    expect(parseMealIdeas("")).toBeNull();
    expect(parseMealIdeas('[{"title": "A", "ingredients": ["x"]')).toBeNull();
    expect(parseMealIdeas('[{"title": 5, "ingredients": []}]')).toBeNull();
    expect(parseMealIdeas('[{"title": "A", "ingredients": "x"}]')).toBeNull();
    expect(parseMealIdeas('[{"title": "A"}]')).toBeNull();
    expect(parseMealIdeas("[null]")).toBeNull();
    expect(parseMealIdeas("][")).toBeNull();
  });

  it("returns null for a blank or over-long title and too many ingredients", () => {
    expect(parseMealIdeas('[{"title": "   ", "ingredients": []}]')).toBeNull();
    expect(parseMealIdeas(JSON.stringify([{ title: "x".repeat(101), ingredients: [] }]))).toBeNull();
    expect(parseMealIdeas(JSON.stringify([{ title: "A", ingredients: Array(21).fill("x") }]))).toBeNull();
  });

  it("trims titles and cleans ingredients", () => {
    expect(parseMealIdeas('[{"title": "  Soep ", "ingredients": [" ui ", "", "Ui"]}]')).toEqual([
      { title: "Soep", ingredients: ["ui"] },
    ]);
  });

  it("treats whitespace-only items as an empty pantry", () => {
    expect(buildMealPrompt(["  ", ""])).toContain("niets bijzonders");
  });
});

describe("sync schema for recipes and mealPlan", () => {
  const date = seed.mealPlan[0].date;
  const update = (patch: object, c: string, key: string) => ({ op: "update", c, key, patch });

  it("accepts recipe update and delete", () => {
    expect(parseChangeset(cs(update({ ingredients: ["a"] }, "recipes", "rc1"))).ok).toBe(true);
    expect(parseChangeset(cs({ op: "delete", c: "recipes", key: "rc1" })).ok).toBe(true);
  });

  it("rejects a recipe with too many ingredients, an empty ingredient or extra fields", () => {
    expect(parseChangeset(cs(update({ ingredients: Array(51).fill("x") }, "recipes", "rc1"))).ok).toBe(false);
    expect(parseChangeset(cs(update({ ingredients: [""] }, "recipes", "rc1"))).ok).toBe(false);
    const row = { id: "rc9", name: "A", ingredients: [], position: 4, householdId: "h" };
    expect(parseChangeset(cs({ op: "insert", c: "recipes", row })).ok).toBe(false);
  });

  it("accepts a mealPlan insert with null recipeId and rejects an empty title", () => {
    const row = { date, title: "Friet", recipeId: null, cookId: "m1" };
    expect(parseChangeset(cs({ op: "insert", c: "mealPlan", row })).ok).toBe(true);
    expect(parseChangeset(cs({ op: "insert", c: "mealPlan", row: { ...row, title: "  " } })).ok).toBe(false);
  });

  it("rejects a mealPlan row without title", () => {
    const row = { date, recipeId: null, cookId: "m1" };
    expect(parseChangeset(cs({ op: "insert", c: "mealPlan", row })).ok).toBe(false);
  });
});
