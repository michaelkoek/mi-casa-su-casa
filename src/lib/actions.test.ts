import { describe, expect, it } from "vitest";
import {
  categorizeTransaction,
  claimCare,
  cycleStock,
  cycleCare,
  addShopping,
  addChore,
  addSignal,
  removeSignal,
  updateSignal,
  removeChore,
  updateChore,
  clearMeal,
  deleteShopping,
  materialsToShopping,
  missingToShopping,
  needItems,
  planDay,
  planMeal,
  saveRecipe,
  setBudget,
  addCategory,
  toggleSignal,
  toggleTask,
  addDose, updateDose, removeDose, addTemperature, updateTemperature, removeTemperature, updateAppointment,
  updateMilestone, removeMilestone, updateGrowth, removeGrowth, updateFood, removeFood, addRoutine, updateRoutine,
  removeRoutine, addMedicine, updateMedicine, removeMedicine, addSize, updateSize, removeSize, addStock, renameStock, removeStock,
} from "./actions";
import { createSeed } from "./seed";

const now = new Date("2026-10-24T14:00:00");

describe("actions", () => {
  it("addChore appends a trimmed chore and ignores an empty title", () => {
    const s = createSeed(now);
    const input = { title: " Ramen lappen ", intervalDays: 30, rotation: ["m2", "m1"], nextDue: "2026-10-30" };
    const next = addChore(input, "c9")(s);
    expect(next.chores).toHaveLength(s.chores.length + 1);
    expect(next.chores.at(-1)).toEqual({ ...input, title: "Ramen lappen", id: "c9" });
    expect(addChore({ ...input, title: "  " })(s)).toBe(s);
  });

  it("updateChore patches only the target and ignores an empty title", () => {
    const s = createSeed(now);
    const next = updateChore("c1", { intervalDays: 14, rotation: ["m2"] })(s);
    expect(next.chores[0]).toMatchObject({ id: "c1", intervalDays: 14, rotation: ["m2"] });
    expect(next.chores.slice(1)).toEqual(s.chores.slice(1));
    next.chores.slice(1).forEach((c, i) => expect(c).toBe(s.chores[i + 1]));
    expect(updateChore("c1", { title: " " })(s)).toBe(s);
  });

  it("addChore cuts the title to 100 chars; updateChore trims, cuts and ignores unknown ids", () => {
    const s = createSeed(now);
    const input = { title: "x".repeat(150), intervalDays: 7, rotation: ["m1"], nextDue: "2026-10-30" };
    expect(addChore(input, "c9")(s).chores.at(-1)?.title).toHaveLength(100);
    expect(updateChore("c1", { title: "  " + "y".repeat(150) })(s).chores[0].title).toBe("y".repeat(100));
    expect(updateChore("nope", { intervalDays: 3 })(s).chores).toEqual(s.chores);
  });

  it("removeChore with an unknown id changes nothing", () => {
    const s = createSeed(now);
    expect(removeChore("nope")(s).chores).toEqual(s.chores);
  });

  it("removeChore removes only the target", () => {
    const s = createSeed(now);
    expect(removeChore("c2")(s).chores.map((c) => c.id)).toEqual(["c1", "c3", "c4"]);
  });

  it("addCategory accepts a null budget", () => {
    const s = createSeed(now);
    const next = addCategory("Abonnementen", null)(s);
    expect(next.categories).toHaveLength(s.categories.length + 1);
    expect(next.categories.at(-1)).toMatchObject({ name: "Abonnementen", budgetCents: null });
  });

  it("setBudget changes only that category and can clear it", () => {
    const s = createSeed(now);
    const set = setBudget("food", 30000)(s);
    expect(set.categories.find((c) => c.id === "food")?.budgetCents).toBe(30000);
    const cleared = setBudget("food", null)(s);
    expect(cleared.categories.find((c) => c.id === "food")?.budgetCents).toBeNull();
    for (const c of s.categories.filter((c) => c.id !== "food")) {
      expect(cleared.categories.find((x) => x.id === c.id)).toBe(c);
      expect(set.categories.find((x) => x.id === c.id)).toBe(c);
    }
  });

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

  it("addSignal appends a closed signal, ignores an empty label and the 13th", () => {
    const s = createSeed(now);
    const next = addSignal({ label: " Koffie op ", icon: "coffee" }, "sg9")(s);
    expect(next.signals.at(-1)).toEqual({ id: "sg9", label: "Koffie op", icon: "coffee", openedBy: null, openedAt: null });
    expect(next.signals).toHaveLength(s.signals.length + 1);
    expect(addSignal({ label: "  ", icon: "coffee" })(s)).toBe(s);
    const full = { ...s, signals: Array.from({ length: 12 }, (_, i) => ({ ...s.signals[1], id: `f${i}` })) };
    expect(addSignal({ label: "Nog een", icon: "coffee" })(full)).toBe(full);
  });

  it("updateSignal changes label and icon but keeps the open state", () => {
    const s = createSeed(now);
    const next = updateSignal("trash", { label: "Afval", icon: "broom" })(s);
    expect(next.signals[0]).toEqual({ ...s.signals[0], label: "Afval", icon: "broom" });
    expect(next.signals[0].openedBy).toBe("m2");
    expect(next.signals[0].openedAt).not.toBeNull();
    next.signals.slice(1).forEach((x, i) => expect(x).toBe(s.signals[i + 1]));
    expect(updateSignal("trash", { label: " ", icon: "broom" })(s)).toBe(s);
    expect(updateSignal("nope", { label: "X", icon: "broom" })(s).signals).toEqual(s.signals);
  });

  it("removeSignal removes only that signal", () => {
    const s = createSeed(now);
    const next = removeSignal("paper")(s);
    expect(next.signals.map((x) => x.id)).toEqual(s.signals.map((x) => x.id).filter((x) => x !== "paper"));
    expect(removeSignal("nope")(s).signals).toEqual(s.signals);
  });
});

describe("signal limits", () => {
  it("addSignal cuts overlong labels to MAX_SIGNAL_LABEL", () => {
    const s = createSeed(new Date("2026-10-28T10:00:00Z"));
    const base = { ...s, signals: [] };
    const next = addSignal({ label: "x".repeat(60), icon: "coffee" }, "n1")(base);
    expect(next.signals[0].label).toHaveLength(40);
  });
  it("addSignal is allowed at 11 and refused at 12", () => {
    const s = createSeed(new Date("2026-10-28T10:00:00Z"));
    const mk = (n: number) => ({ ...s, signals: Array.from({ length: n }, (_, i) => ({ id: `f${i}`, label: "x", icon: "trash" as const, openedBy: null, openedAt: null })) });
    expect(addSignal({ label: "Y", icon: "coffee" }, "n")(mk(11)).signals).toHaveLength(12);
    expect(addSignal({ label: "Y", icon: "coffee" }, "n")(mk(12)).signals).toHaveLength(12);
  });
});

describe("child updaters", () => {
  const s = createSeed(new Date("2026-10-28T10:00:00Z"));

  it("updateDose patches only the target, never `by`, and validates", () => {
    const withTwo = addDose("ibu", "5 ml", "m1", new Date("2026-10-28T09:00:00Z"))(s);
    const other = withTwo.doses[1];
    const next = updateDose("d1", { amount: "  240 mg ", at: "2026-10-28T08:00:00Z", medicineId: "ibu" })(withTwo);
    expect(next.doses[0]).toEqual({ id: "d1", medicineId: "ibu", amount: "240 mg", at: "2026-10-28T08:00:00.000Z", by: "m2" });
    expect(next.doses[1]).toBe(other);
    expect(updateDose("d1", { medicineId: "nope" })(s)).toBe(s);
    expect(updateDose("d1", { at: "garbage" })(s)).toBe(s);
    expect(updateDose("nope", { amount: "x" })(s)).toEqual(s);
  });
  it("removeDose and removeTemperature filter only their own array", () => {
    expect(removeDose("d1")(s).doses).toHaveLength(0);
    expect(removeTemperature("tp1")(s).temperatures).toHaveLength(0);
    expect(removeDose("nope")(s)).toEqual(s);
  });
  it("addTemperature and updateTemperature", () => {
    expect(addTemperature(38, new Date("2026-10-28T09:00:00Z"))(s).temperatures.at(-1)?.at).toBe("2026-10-28T09:00:00.000Z");
    expect(updateTemperature("tp1", { celsius: 39.2, at: "2026-10-28T07:00:00Z" })(s).temperatures[0]).toEqual({ id: "tp1", celsius: 39.2, at: "2026-10-28T07:00:00.000Z" });
    for (const c of [29.9, 45.1, NaN]) expect(updateTemperature("tp1", { celsius: c })(s)).toBe(s);
    expect(updateTemperature("tp1", { at: "x" })(s)).toBe(s);
    expect(updateTemperature("nope", { celsius: 38 })(s)).toEqual(s);
  });
  it("updateAppointment patches, sorts by at and validates", () => {
    const next = updateAppointment("a1", { at: "2099-01-01T10:00:00Z", place: "  " })(s);
    expect(next.appointments.map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(next.appointments[1].place).toBeNull();
    expect(updateAppointment("a1", { title: "  " })(s)).toBe(s);
    expect(updateAppointment("a1", { at: "x" })(s)).toBe(s);
    expect(updateAppointment("a1", { title: "x".repeat(200) })(s).appointments[0].title).toHaveLength(100);
    expect(updateAppointment("nope", { title: "x" })(s)).toEqual(s);
  });
  it("updateMilestone and removeMilestone", () => {
    const next = updateMilestone("ms1", { text: " Loopt ", date: "2026-10-01" })(s);
    expect(next.milestones[0]).toEqual({ id: "ms1", text: "Loopt", date: "2026-10-01" });
    expect(next.milestones[1]).toBe(s.milestones[1]);
    expect(updateMilestone("ms1", { text: " " })(s)).toBe(s);
    expect(updateMilestone("ms1", { date: "1-2-3" })(s)).toBe(s);
    expect(updateMilestone("nope", { text: "x" })(s)).toEqual(s);
    expect(removeMilestone("ms1")(s).milestones.map((m) => m.id)).toEqual(["ms2"]);
  });
  it("updateGrowth keeps growth sorted and validates", () => {
    const next = updateGrowth("g1", { date: "2026-10-27", weightGrams: 9900, lengthCm: 78 })(s);
    expect(next.growth.map((g) => g.id)).toEqual(["g2", "g1"]);
    expect(next.growth[1]).toEqual({ id: "g1", date: "2026-10-27", weightGrams: 9900, lengthCm: 78 });
    expect(updateGrowth("g1", { weightGrams: 9.5 })(s)).toBe(s);
    expect(updateGrowth("g1", { weightGrams: 200001 })(s)).toBe(s);
    expect(updateGrowth("g1", { lengthCm: 251 })(s)).toBe(s);
    expect(updateGrowth("g1", { date: "nope" })(s)).toBe(s);
    expect(updateGrowth("nope", { lengthCm: 70 })(s)).toEqual(s);
    expect(removeGrowth("g1")(s).growth.map((g) => g.id)).toEqual(["g2"]);
  });
  it("updateFood and removeFood", () => {
    const next = updateFood("f1", { name: " Peer ", verdict: "dislikes" })(s);
    expect(next.foods[0]).toMatchObject({ id: "f1", name: "Peer", verdict: "dislikes" });
    expect(next.foods[1]).toBe(s.foods[1]);
    expect(updateFood("f1", { name: "" })(s)).toBe(s);
    expect(updateFood("nope", { name: "x" })(s)).toEqual(s);
    expect(removeFood("f1")(s).foods).toHaveLength(2);
  });
  it("routine stays sorted by time (stable) and validates", () => {
    const added = addRoutine({ time: "10:00", label: "Fruit" }, "rt9")(s);
    expect(added.routine.map((r) => r.id)).toEqual(["rt1", "rt9", "rt2", "rt3", "rt4", "rt5"]);
    expect(addRoutine({ time: "12:00", label: "Soep" }, "rt8")(s).routine.map((r) => r.id)).toEqual(["rt1", "rt2", "rt8", "rt3", "rt4", "rt5"]);
    expect(addRoutine({ time: "25:00", label: "x" })(s)).toBe(s);
    expect(addRoutine({ time: "10:00", label: " " })(s)).toBe(s);
    const moved = updateRoutine("rt5", { time: "08:00", label: "Wakker" })(s);
    expect(moved.routine[0]).toEqual({ id: "rt5", time: "08:00", label: "Wakker" });
    expect(updateRoutine("rt5", { time: "8:00" })(s)).toBe(s);
    expect(updateRoutine("rt5", { label: "" })(s)).toBe(s);
    expect(updateRoutine("nope", { label: "x" })(s)).toEqual(s);
    expect(removeRoutine("rt1")(s).routine).toHaveLength(4);
  });
  it("medicines: add, update, validate, and remove drops only its doses", () => {
    expect(addMedicine({ name: "Vitamine D", intervalHours: 24 }, "md9")(s).medicines.at(-1)).toEqual({ id: "md9", name: "Vitamine D", intervalHours: 24 });
    expect(addMedicine({ name: " ", intervalHours: 6 })(s)).toBe(s);
    for (const h of [0, 73, 1.5]) expect(addMedicine({ name: "x", intervalHours: h })(s)).toBe(s);
    expect(updateMedicine("para", { name: " Dafalgan ", intervalHours: 4 })(s).medicines[0]).toEqual({ id: "para", name: "Dafalgan", intervalHours: 4 });
    expect(updateMedicine("para", { intervalHours: 100 })(s)).toBe(s);
    expect(updateMedicine("para", { name: "" })(s)).toBe(s);
    expect(updateMedicine("nope", { name: "x" })(s)).toEqual(s);
    const withIbu = addDose("ibu", "x", "m1", new Date())(s);
    const next = removeMedicine("para")(withIbu);
    expect(next.medicines.map((m) => m.id)).toEqual(["ibu"]);
    expect(next.doses.map((d) => d.medicineId)).toEqual(["ibu"]);
  });
  it("sizes: add, update (note empty -> null), remove", () => {
    expect(addSize({ label: " Muts ", size: "48", note: "" }, "z9")(s).sizes.at(-1)).toEqual({ id: "z9", label: "Muts", size: "48", note: null });
    expect(addSize({ label: "", size: "48", note: null })(s)).toBe(s);
    const next = updateSize("z1", { size: " 92 ", note: "" })(s);
    expect(next.sizes[0]).toEqual({ id: "z1", label: "Kleding", size: "92", note: null });
    expect(next.sizes[1]).toBe(s.sizes[1]);
    expect(updateSize("z1", { size: " " })(s)).toBe(s);
    expect(updateSize("z1", { label: "" })(s)).toBe(s);
    expect(updateSize("nope", { size: "1" })(s)).toEqual(s);
    expect(removeSize("z1")(s).sizes).toHaveLength(3);
  });
  it("stock: add at full, rename, remove", () => {
    expect(addStock(" Zeep ", "st9")(s).stock.at(-1)).toEqual({ id: "st9", name: "Zeep", level: "full" });
    expect(addStock(" ")(s)).toBe(s);
    const next = renameStock("st1", " Luiers 5 ")(s);
    expect(next.stock[0]).toEqual({ id: "st1", name: "Luiers 5", level: "low" });
    expect(next.stock[1]).toBe(s.stock[1]);
    expect(renameStock("st1", "")(s)).toBe(s);
    expect(renameStock("nope", "x")(s)).toEqual(s);
    expect(removeStock("st1")(s).stock).toHaveLength(3);
  });
});
