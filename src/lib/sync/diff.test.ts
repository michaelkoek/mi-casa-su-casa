import { describe, expect, it } from "vitest";
import * as actions from "../actions";
import { createSeed } from "../seed";
import type { HouseholdState } from "../types";
import type { Changeset } from "./collections";
import { applyChangeset, diffState, orderChanges, rebase, revertTo } from "./diff";

const now = new Date("2026-10-24T14:00:00");
const seed = createSeed(now);

/** One representative call for every exported updater. */
const cases: Record<string, (s: HouseholdState) => HouseholdState> = {
  toggleTask: actions.toggleTask("t1", now),
  addTask: actions.addTask("Nieuw", "m2", "2026-10-30"),
  toggleSignal: actions.toggleSignal("paper", "m1", now),
  doneChore: actions.doneChore("c1", now),
  addChore: actions.addChore({ title: "Ramen", intervalDays: 30, rotation: ["m1", "m2"], nextDue: "2026-10-30" }),
  updateChore: actions.updateChore("c1", { intervalDays: 14 }),
  removeChore: actions.removeChore("c2"),
  addSignal: actions.addSignal({ label: "Koffie op", icon: "coffee" }),
  updateSignal: actions.updateSignal("paper", { label: "Oud papier", icon: "paper" }),
  removeSignal: actions.removeSignal("laundry"),
  addProject: actions.addProject({ title: "Nieuw", room: "Hal", kind: "finish", priority: "low", costCents: 100 }),
  setProjectStatus: actions.setProjectStatus("p1", "done"),
  addMaterial: actions.addMaterial("p1", "Schroeven"),
  toggleMaterial: actions.toggleMaterial("p1", "mt2"),
  materialsToShopping: actions.materialsToShopping("p1"),
  categorizeTransaction: actions.categorizeTransaction("x12", "home", true),
  addExpense: actions.addExpense(1250, "Bakker", "food", now),
  setBudget: actions.setBudget("food", 50000),
  setTransfer: actions.setTransfer("x05", true),
  addCategory: actions.addCategory("Abonnementen", 5000),
  addDose: actions.addDose("para", "120 mg", "m1", now),
  addTemperature: actions.addTemperature(38.5, now),
  addAppointment: actions.addAppointment("Tandarts", "2026-10-25T08:00:00.000Z", null),
  removeAppointment: actions.removeAppointment("a1"),
  cycleCare: actions.cycleCare(1, "bring"),
  toggleShopping: actions.toggleShopping("s1"),
  addShopping: actions.addShopping("Brood"),
  needItems: actions.needItems(["Penne", "Brood"], "manual"),
  deleteShopping: actions.deleteShopping("s3"),
  missingToShopping: actions.missingToShopping(["Penne", "Ui"]),
  planMeal: actions.planMeal(seed.mealPlan[0].date, { title: "Linzensoep", recipeId: "rc3", cookId: "m2" }),
  clearMeal: actions.clearMeal(seed.mealPlan[0].date),
  saveRecipe: actions.saveRecipe("Shakshuka", ["Eieren", "Tomaat"], "rc9"),
  planDay: actions.planDay(seed.mealPlan[0].date, { title: "Shakshuka", ingredients: ["Eieren", "Tomaat"], cookId: "m1" }),
  renameMember: actions.renameMember("m2", "Sanne"),
  addMilestone: actions.addMilestone("Eerste woordje", "2026-10-20"),
  claimCare: actions.claimCare(3, "bring", "m2"),
  setHomeDay: actions.setHomeDay(1, true),
  setSize: actions.setSize("z1", "92", null),
  cycleStock: actions.cycleStock("st3"),
  addGrowth: actions.addGrowth(10000, 78, "2026-10-01"),
  addFood: actions.addFood("Banaan", "2026-10-20", "likes"),
  cycleFood: actions.cycleFood("f1"),
};

/** applyChangeset ignores `bank`, like diffState does. */
const withBank = (s: HouseholdState, like: HouseholdState) => ({ ...s, bank: like.bank });

describe("diffState / applyChangeset", () => {
  it("covers every exported updater", () => {
    const exported = Object.keys(actions).sort();
    expect(Object.keys(cases).sort()).toEqual(exported);
  });

  for (const [name, fn] of Object.entries(cases)) {
    it(`round-trips ${name}`, () => {
      const next = fn(seed);
      const result = applyChangeset(seed, diffState(seed, next));
      expect(withBank(result, next)).toEqual(next);
    });
  }

  it("round-trips clearing a budget (null)", () => {
    const next = actions.setBudget("food", null)(seed);
    expect(next.categories.find((c) => c.id === "food")?.budgetCents).toBeNull();
    const changes = diffState(seed, next);
    expect(changes).toHaveLength(1);
    expect(withBank(applyChangeset(seed, changes), next)).toEqual(next);
  });

  it("toggleTask gives one update with only doneAt", () => {
    const changes = diffState(seed, actions.toggleTask("t1", now)(seed));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ op: "update", c: "tasks", key: "t1" });
    expect(Object.keys((changes[0] as { patch: object }).patch)).toEqual(["doneAt"]);
  });

  it("addTask gives one insert", () => {
    const changes = diffState(seed, actions.addTask("Nieuw", "m2", null)(seed));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ op: "insert", c: "tasks" });
  });

  it("addChore gives one insert", () => {
    const changes = diffState(seed, actions.addChore({ title: "Ramen", intervalDays: 30, rotation: ["m1", "m2"], nextDue: "2026-10-30" })(seed));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ op: "insert", c: "chores" });
  });

  it("addSignal gives one insert", () => {
    const changes = diffState(seed, actions.addSignal({ label: "Koffie op", icon: "coffee" })(seed));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ op: "insert", c: "signals" });
  });

  it("updateSignal gives one update with label and icon only", () => {
    const changes = diffState(seed, actions.updateSignal("paper", { label: "Oud papier", icon: "drop" })(seed));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ op: "update", c: "signals", key: "paper" });
    expect(Object.keys((changes[0] as { patch: object }).patch).sort()).toEqual(["icon", "label"]);
  });

  it("removeSignal of the last signal gives one delete", () => {
    expect(diffState(seed, actions.removeSignal("glass")(seed))).toEqual([{ op: "delete", c: "signals", key: "glass" }]);
  });

  it("removeChore gives a delete", () => {
    expect(diffState(seed, actions.removeChore("c4")(seed))).toEqual([{ op: "delete", c: "chores", key: "c4" }]);
    const changes = diffState(seed, actions.removeChore("c1")(seed));
    expect(changes.filter((c) => c.op === "delete")).toEqual([{ op: "delete", c: "chores", key: "c1" }]);
    for (const u of changes.filter((c) => c.op === "update")) expect(Object.keys((u as { patch: object }).patch)).toEqual(["position"]);
  });

  it("deleteShopping gives deletes plus position updates", () => {
    const changes = diffState(seed, actions.deleteShopping("s3")(seed));
    expect(changes.filter((c) => c.op === "delete")).toEqual([{ op: "delete", c: "shopping", key: "s3" }]);
    const updates = changes.filter((c) => c.op === "update");
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) expect(Object.keys((u as { patch: object }).patch)).toEqual(["position"]);
  });

  it("planMeal updates the key date; cycleCare updates the key as a weekday string", () => {
    const date = seed.mealPlan[0].date;
    const meal = diffState(seed, actions.planMeal(date, { title: "Linzensoep", recipeId: "rc3", cookId: "m1" })(seed));
    expect(meal).toEqual([{ op: "update", c: "mealPlan", key: date, patch: { title: "Linzensoep", recipeId: "rc3" } }]);
    const care = diffState(seed, actions.cycleCare(1, "bring")(seed));
    expect(care[0]).toMatchObject({ op: "update", c: "care", key: "1" });
  });

  it("gives [] for a no-op and ignores me/bank", () => {
    expect(diffState(seed, seed)).toEqual([]);
    expect(diffState(seed, { ...seed, me: "m2", bank: [] })).toEqual([]);
  });
});

describe("revertTo", () => {
  it("reverts only its own change and keeps a concurrent one", () => {
    const after = actions.toggleTask("t1", now)(seed);
    // The other member changed another task and a shopping item in the meantime.
    const current = actions.toggleShopping("s1")(actions.toggleTask("t3", now)(after));
    const reverted = revertTo(seed, after)(current);
    expect(reverted.tasks.find((t) => t.id === "t1")?.doneAt).toBeNull();
    expect(reverted.tasks.find((t) => t.id === "t3")?.doneAt).not.toBeNull();
    expect(reverted.shopping.find((i) => i.id === "s1")?.checked).toBe(true);
  });

  it("keeps a concurrent change to another field of the same row", () => {
    const after = actions.toggleSignal("paper", "m1", now)(seed);
    const current = { ...after, signals: after.signals.map((s) => (s.id === "paper" ? { ...s, label: "Papier" } : s)) };
    const reverted = revertTo(seed, after)(current);
    const paper = reverted.signals.find((s) => s.id === "paper");
    expect(paper?.openedAt).toBeNull();
    expect(paper?.label).toBe("Papier");
  });

  it("undoing an add deletes the row", () => {
    const after = actions.addTask("Nieuw", "m2", null)(seed);
    const reverted = revertTo(seed, after)(after);
    expect(reverted.tasks).toEqual(seed.tasks);
    const changes = diffState(after, reverted);
    expect(changes).toEqual([{ op: "delete", c: "tasks", key: after.tasks[after.tasks.length - 1].id }]);
  });
});

describe("rebase", () => {
  it("re-applies pending changesets in order", () => {
    const a = actions.toggleTask("t1", now)(seed);
    const b = actions.addShopping("Brood")(a);
    const queue: Changeset[] = [
      { id: crypto.randomUUID(), changes: diffState(seed, a) },
      { id: crypto.randomUUID(), changes: diffState(a, b) },
    ];
    expect(rebase(seed, queue)).toEqual(b);
    expect(rebase(seed, [])).toEqual(seed);
  });
});

describe("orderChanges", () => {
  it("puts inserts in WRITE_ORDER, then updates, then deletes in reverse order", () => {
    const ordered = orderChanges([
      { op: "delete", c: "projects", key: "p1" },
      { op: "delete", c: "materials", key: "mt1" },
      { op: "update", c: "tasks", key: "t1", patch: { title: "x" } },
      { op: "insert", c: "materials", row: { id: "mtx", projectId: "px", name: "a", bought: false, position: 0 } },
      { op: "insert", c: "projects", row: { id: "px", title: "a", room: "b", kind: "finish", priority: "low", status: "todo", costCents: 0, position: 0 } },
    ]);
    expect(ordered.map((c) => `${c.op}:${c.c}`)).toEqual([
      "insert:projects", "insert:materials", "update:tasks", "delete:materials", "delete:projects",
    ]);
  });
});
