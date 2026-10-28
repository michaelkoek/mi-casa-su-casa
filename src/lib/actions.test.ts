import { describe, expect, it } from "vitest";
import {
  categorizeTransaction,
  claimCare,
  cycleStock,
  cycleCare,
  addShopping,
  clearMeal,
  deleteShopping,
  materialsToShopping,
  missingToShopping,
  needItems,
  planDay,
  planMeal,
  saveRecipe,
  toggleSignal,
  toggleTask,
} from "./actions";
import { createSeed } from "./seed";

const now = new Date("2026-10-24T14:00:00");

describe("actions", () => {
  it("toggles a task done and back", () => {
    const s = createSeed(now);
    const done = toggleTask("t1", now)(s);
    expect(done.tasks.find((t) => t.id === "t1")?.doneAt).not.toBeNull();
    expect(toggleTask("t1", now)(done).tasks.find((t) => t.id === "t1")?.doneAt).toBeNull();
  });

  it("opens a signal for the current member and closes it again", () => {
    const s = createSeed(now);
    const opened = toggleSignal("paper", "m1", now)(s);
    const paper = opened.signals.find((x) => x.id === "paper");
    expect(paper?.openedBy).toBe("m1");
    expect(toggleSignal("paper", "m1", now)(opened).signals.find((x) => x.id === "paper")?.openedAt).toBeNull();
  });

  it("categorizes a transaction and can remember a rule", () => {
    const s = createSeed(now);
    const next = categorizeTransaction("x12", "home", true)(s);
    expect(next.transactions.find((t) => t.id === "x12")?.categoryId).toBe("home");
    expect(next.rules.some((r) => r.contains === "gamma utrecht" && r.categoryId === "home")).toBe(true);
    // A rule covers every branch of a shop, not just this one.
    const branch = categorizeTransaction("x13", "child", true)({
      ...s,
      transactions: s.transactions.map((t) => (t.id === "x13" ? { ...t, counterparty: "Kruidvat 7731 Utrecht" } : t)),
    });
    expect(branch.rules.at(-1)?.contains).toBe("kruidvat");
    const noRule = categorizeTransaction("x13", "child", false)(s);
    expect(noRule.rules).toHaveLength(s.rules.length);
  });

  it("needItems is a no-op for an unchecked existing name", () => {
    const s = createSeed(now);
    expect(needItems(["melk"], "manual")(s)).toBe(s);
  });

  it("needItems puts an in-huis item back on halen and keeps its id", () => {
    const s = createSeed(now);
    const next = needItems(["penne"], "manual")(s);
    expect(next.shopping.find((i) => i.id === "s3")).toMatchObject({ name: "Penne", checked: false, source: "recipe" });
    expect(next.shopping).toHaveLength(s.shopping.length);
  });

  it("needItems appends new names once with the given source", () => {
    const next = needItems(["Ui", "ui", " Ui "], "recipe")(createSeed(now));
    const ui = next.shopping.filter((i) => i.name === "Ui");
    expect(ui).toHaveLength(1);
    expect(ui[0]).toMatchObject({ checked: false, source: "recipe" });
  });

  it("addShopping adds no duplicate", () => {
    const s = createSeed(now);
    expect(addShopping("Melk")(s).shopping.filter((i) => i.name.toLowerCase() === "melk")).toHaveLength(1);
  });

  it("deleteShopping removes only that item", () => {
    const s = createSeed(now);
    const next = deleteShopping("s3")(s);
    expect(next.shopping.map((i) => i.id)).toEqual(s.shopping.filter((i) => i.id !== "s3").map((i) => i.id));
  });

  it("missingToShopping skips what is in huis", () => {
    const next = missingToShopping(["Penne", "Salie", "Ui"])(createSeed(now));
    expect(next.shopping.find((i) => i.id === "s3")?.checked).toBe(true);
    expect(next.shopping.filter((i) => i.name === "Salie")).toHaveLength(1);
    expect(next.shopping.find((i) => i.name === "Ui")).toMatchObject({ checked: false, source: "recipe" });
  });

  it("planMeal replaces a date and keeps the plan sorted; clearMeal removes only that date", () => {
    const s = createSeed(now);
    const d = s.mealPlan[1].date;
    const next = planMeal(d, { title: "Pizza", recipeId: null, cookId: "m1" })(s);
    expect(next.mealPlan).toHaveLength(s.mealPlan.length);
    expect(next.mealPlan.find((m) => m.date === d)).toMatchObject({ title: "Pizza", recipeId: null });
    const dates = next.mealPlan.map((m) => m.date);
    expect(dates).toEqual([...dates].sort());
    const cleared = clearMeal(d)(s);
    expect(cleared.mealPlan.map((m) => m.date)).toEqual(s.mealPlan.map((m) => m.date).filter((x) => x !== d));
    expect(clearMeal("2000-01-01")(s)).toBe(s);
  });

  it("saveRecipe appends a new recipe and updates an existing one by name", () => {
    const s = createSeed(now);
    const added = saveRecipe("Shakshuka", ["Eieren"], "rc9")(s);
    expect(added.recipes.at(-1)).toEqual({ id: "rc9", name: "Shakshuka", ingredients: ["Eieren"] });
    const updated = saveRecipe(" linzensoep ", ["Linzen", "Ui"], "rc10")(s);
    expect(updated.recipes).toHaveLength(s.recipes.length);
    expect(updated.recipes.find((r) => r.id === "rc3")).toEqual({ id: "rc3", name: "Linzensoep", ingredients: ["Linzen", "Ui"] });
    expect(saveRecipe("  ", ["x"])(s)).toBe(s);
  });

  it("planDay with ingredients creates a recipe, plans it and lists only what is missing", () => {
    const s = createSeed(now);
    const date = s.mealPlan[0].date;
    const next = planDay(date, { title: "Shakshuka", ingredients: ["Eieren", "Penne"], cookId: "m2" })(s);
    const recipe = next.recipes.find((r) => r.name === "Shakshuka");
    expect(recipe).toBeDefined();
    expect(next.mealPlan.find((m) => m.date === date)).toEqual({ date, title: "Shakshuka", recipeId: recipe!.id, cookId: "m2" });
    expect(next.shopping.find((i) => i.name === "Eieren")).toMatchObject({ checked: false, source: "recipe" });
    expect(next.shopping.find((i) => i.id === "s3")?.checked).toBe(true);
  });

  it("planDay without ingredients leaves recipes and shopping alone", () => {
    const s = createSeed(now);
    const date = s.mealPlan[0].date;
    const next = planDay(date, { title: "Friet", ingredients: [], cookId: "m1" })(s);
    expect(next.mealPlan.find((m) => m.date === date)).toMatchObject({ title: "Friet", recipeId: null });
    expect(next.recipes).toBe(s.recipes);
    expect(next.shopping).toBe(s.shopping);
    expect(planDay(date, { title: "  ", ingredients: ["x"], cookId: "m1" })(s)).toBe(s);
  });

  it("puts unbought project materials on the shopping list once", () => {
    const s = createSeed(now);
    const next = materialsToShopping("p1")(s);
    expect(next.shopping.filter((i) => i.name === "Plexiglas bovenlicht")).toHaveLength(1);
    expect(next.shopping.some((i) => i.name === "Scharnieren")).toBe(true);
    expect(next.shopping.some((i) => i.name === "Deur 60 cm")).toBe(false);
  });

  it("cycles who brings the child, then marks the day at home", () => {
    let s = createSeed(now);
    s = cycleCare(1, "bring")(s);
    expect(s.care[0].bring).toBe("m2");
    s = cycleCare(1, "bring")(s);
    expect(s.care[0].bring).toBe("grandma");
    s = cycleCare(1, "bring")(s);
    expect(s.care[0].atHome).toBe(true);
    s = cycleCare(1, "bring")(s);
    expect(s.care[0]).toMatchObject({ atHome: false, bring: "m1", pick: "m2" });
  });

  it("claims picking up on a day", () => {
    const s = createSeed(now);
    const next = claimCare(1, "pick", "m1")(s);
    expect(next.care[0].pick).toBe("m1");
    const homeDay = claimCare(3, "pick", "m2")(s);
    expect(homeDay.care[2]).toMatchObject({ atHome: false, pick: "m2", bring: "m2" });
  });

  it("puts stock on the shopping list when it runs low, once", () => {
    let s = createSeed(now);
    s = cycleStock("st2")(s); // half -> low
    expect(s.stock.find((x) => x.id === "st2")?.level).toBe("low");
    expect(s.shopping.filter((x) => x.name === "Billendoekjes")).toHaveLength(1);
    s = cycleStock("st2")(cycleStock("st2")(cycleStock("st2")(s))); // low -> full -> half -> low
    expect(s.shopping.filter((x) => x.name === "Billendoekjes")).toHaveLength(1);
  });
});
