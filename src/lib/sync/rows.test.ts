import { describe, expect, it } from "vitest";
import { createSeed } from "../seed";
import { fromRows, toRows } from "./rows";

const now = new Date("2026-10-24T14:00:00");

describe("rows", () => {
  it("round-trips the seed", () => {
    const seed = createSeed(now);
    expect(fromRows(toRows(seed), "m1", seed.bank)).toEqual(seed);
  });

  it("flattens materials with project id and positions", () => {
    const rows = toRows(createSeed(now));
    const p1 = rows.materials.filter((m) => m.projectId === "p1");
    expect(p1.map((m) => [m.id, m.position])).toEqual([["mt1", 0], ["mt2", 1], ["mt3", 2]]);
    expect(rows.projects[0]).not.toHaveProperty("materials");
  });

  it("sorts care by weekday and the meal plan by date", () => {
    const seed = createSeed(now);
    const shuffled = { ...seed, care: [...seed.care].reverse(), mealPlan: [...seed.mealPlan].reverse() };
    const rows = toRows(shuffled);
    expect(rows.care.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.mealPlan.map((m) => m.date)).toEqual([...rows.mealPlan.map((m) => m.date)].sort());
  });

  it("orders by position when rebuilding", () => {
    const rows = toRows(createSeed(now));
    rows.tasks.reverse();
    const state = fromRows(rows, "m1", []);
    expect(state.tasks.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
  });
});
