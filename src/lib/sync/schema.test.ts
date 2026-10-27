import { describe, expect, it } from "vitest";
import * as actions from "../actions";
import { createSeed, createStarter } from "../seed";
import { COLLECTION_NAMES, type Change } from "./collections";
import { diffState } from "./diff";
import { toRows } from "./rows";
import { memberRefIssues, parseChangeset, rowSchemas } from "./schema";

const now = new Date("2026-10-24T14:00:00");
const seed = createSeed(now);
const uuid = () => crypto.randomUUID();
const cs = (...changes: unknown[]) => ({ id: uuid(), changes });
const update = (patch: object, c = "tasks", key = "t1") => ({ op: "update", c, key, patch });

describe("row schemas", () => {
  it("accept every row of the seed and of the starter set", () => {
    const starter = createStarter([{ id: "m1", name: "A" }, { id: "m2", name: "B" }], now);
    for (const state of [seed, starter]) {
      const rows = toRows(state);
      for (const c of COLLECTION_NAMES) {
        for (const row of rows[c]) expect(rowSchemas[c].safeParse(row).success, `${c}`).toBe(true);
      }
    }
  });
});

describe("parseChangeset", () => {
  const updaters: Record<string, (s: typeof seed) => typeof seed> = {
    toggleTask: actions.toggleTask("t1", now),
    addTask: actions.addTask("Nieuw", "m2", "2026-10-30"),
    toggleSignal: actions.toggleSignal("paper", "m1", now),
    doneChore: actions.doneChore("c1", now),
    addMaterial: actions.addMaterial("p1", "Schroeven"),
    deleteShopping: actions.deleteShopping("s3"),
    categorizeTransaction: actions.categorizeTransaction("x12", "home", true),
    addExpense: actions.addExpense(1250, "Bakker", "food", now),
    addDose: actions.addDose("para", "120 mg", "m1", now),
    addAppointment: actions.addAppointment("Tandarts", "2026-10-25T08:00:00.000Z", null),
    cycleCare: actions.cycleCare(1, "bring"),
    planMeal: actions.planMeal(seed.mealPlan[0].date, { title: "Linzensoep", recipeId: "rc3", cookId: "m2" }),
    planDay: actions.planDay(seed.mealPlan[0].date, { title: "Shakshuka", ingredients: ["Eieren", "Tomaat"], cookId: "m1" }),
    clearMeal: actions.clearMeal(seed.mealPlan[0].date),
    renameMember: actions.renameMember("m2", "Sanne"),
    addMilestone: actions.addMilestone("Eerste woordje", "2026-10-20"),
    addGrowth: actions.addGrowth(10000, 78, "2026-10-01"),
    cycleStock: actions.cycleStock("st3"),
    setSize: actions.setSize("z1", "92", null),
  };

  for (const [name, fn] of Object.entries(updaters)) {
    it(`accepts the changeset and its undo for ${name}`, () => {
      const next = fn(seed);
      for (const changes of [diffState(seed, next), diffState(next, seed)]) {
        if (changes.length === 0) continue;
        expect(parseChangeset({ id: uuid(), changes }).ok, name).toBe(true);
      }
    });
  }

  it("rejects an unknown collection", () => {
    expect(parseChangeset(cs({ op: "delete", c: "households", key: "x" })).ok).toBe(false);
  });

  it("rejects ops that are not allowed", () => {
    expect(parseChangeset(cs({ op: "insert", c: "members", row: { id: "m9", name: "Eve", position: 2 } })).ok).toBe(false);
    expect(parseChangeset(cs(update({ label: "x" }, "routine", "rt1"))).ok).toBe(false);
  });

  it("accepts recipe inserts and free-text meals, and rejects a too long title", () => {
    const recipe = { id: "rc9", name: "Shakshuka", ingredients: ["Eieren"], position: 4 };
    expect(parseChangeset(cs({ op: "insert", c: "recipes", row: recipe })).ok).toBe(true);
    const date = seed.mealPlan[0].date;
    expect(parseChangeset(cs(update({ title: "Pasta", recipeId: null }, "mealPlan", date))).ok).toBe(true);
    expect(parseChangeset(cs(update({ title: "x".repeat(101) }, "mealPlan", date))).ok).toBe(false);
  });

  it("rejects unknown or extra fields, including householdId", () => {
    expect(parseChangeset(cs(update({ householdId: "abc" }))).ok).toBe(false);
    expect(parseChangeset(cs(update({ nope: 1 }))).ok).toBe(false);
    expect(parseChangeset(cs(update({ id: "other" }))).ok).toBe(false);
    const row = { id: "t9", title: "x", assigneeId: "m1", due: null, dueLabel: null, doneAt: null, position: 9 };
    expect(parseChangeset(cs({ op: "insert", c: "tasks", row })).ok).toBe(true);
    expect(parseChangeset(cs({ op: "insert", c: "tasks", row: { ...row, householdId: "abc" } })).ok).toBe(false);
    expect(parseChangeset(cs({ op: "insert", c: "tasks", row, householdId: "abc" })).ok).toBe(false);
    expect(parseChangeset({ ...cs(update({ title: "x" })), householdId: "abc" }).ok).toBe(true); // top-level extras are ignored, never read
  });

  it("rejects an empty patch and more than 500 changes", () => {
    expect(parseChangeset(cs(update({}))).ok).toBe(false);
    expect(parseChangeset(cs()).ok).toBe(false);
    const many = Array.from({ length: 501 }, (_, i) => ({ op: "delete", c: "tasks", key: `t${i}` }));
    expect(parseChangeset(cs(...many)).ok).toBe(false);
    expect(parseChangeset(cs(...many.slice(0, 500))).ok).toBe(true);
  });

  it("rejects a bad enum, a bad date and a long key", () => {
    expect(parseChangeset(cs(update({ status: "weird" }, "projects", "p1"))).ok).toBe(false);
    expect(parseChangeset(cs(update({ nextDue: "24-10-2026" }, "chores", "c1"))).ok).toBe(false);
    expect(parseChangeset(cs(update({ nextDue: "2026-02-31" }, "chores", "c1"))).ok).toBe(false);
    expect(parseChangeset(cs(update({ title: "x" }, "tasks", "k".repeat(65)))).ok).toBe(false);
    expect(parseChangeset(cs({ op: "delete", c: "tasks", key: "k".repeat(65) })).ok).toBe(false);
  });
});

describe("memberRefIssues", () => {
  const members = new Set(["m1", "m2"]);
  const change = (c: string, patch: object): Change => ({ op: "update", c, key: "1", patch }) as unknown as Change;

  it("flags unknown rotation and care members", () => {
    expect(memberRefIssues([change("chores", { rotation: ["m1", "m9"] })], members)).not.toEqual([]);
    expect(memberRefIssues([change("care", { bring: "m9" })], members)).not.toEqual([]);
    expect(memberRefIssues([change("care", { pick: "m9" })], members)).not.toEqual([]);
  });

  it("allows grandma, null and known members", () => {
    expect(memberRefIssues([change("chores", { rotation: ["m2", "m1"] })], members)).toEqual([]);
    expect(memberRefIssues([change("care", { bring: "grandma", pick: null })], members)).toEqual([]);
    expect(memberRefIssues([change("care", { bring: "m1" })], members)).toEqual([]);
  });
});
