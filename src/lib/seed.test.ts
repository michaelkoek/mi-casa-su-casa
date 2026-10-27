import { describe, expect, it } from "vitest";
import { createSeed, createStarter } from "./seed";

const members = [
  { id: "m1", name: "Michael" },
  { id: "m2", name: "Sanne" },
];
const now = new Date("2026-10-24T14:00:00");

describe("createStarter", () => {
  const s = createStarter(members, now);

  it("has the given members and me is the first", () => {
    expect(s.members).toEqual(members);
    expect(s.me).toBe("m1");
  });

  it("starts without demo content", () => {
    for (const key of ["tasks", "projects", "transactions", "rules", "doses", "temperatures", "appointments",
      "milestones", "growth", "foods", "recipes", "mealPlan", "shopping", "events", "stock"] as const) {
      expect(s[key]).toEqual([]);
    }
    expect(s.signals.every((x) => x.openedAt === null && x.openedBy === null)).toBe(true);
  });

  it("rotates every chore over all members", () => {
    expect(s.chores.length).toBeGreaterThan(0);
    for (const c of s.chores) expect(c.rotation).toEqual(["m1", "m2"]);
  });

  it("has 5 care days, a medicine and no bank", () => {
    expect(s.care).toHaveLength(5);
    expect(s.medicines.length).toBeGreaterThanOrEqual(1);
    expect(s.bank).toEqual([]);
  });

  it("leaves the demo seed intact", () => {
    expect(createSeed(now).bank).not.toBeNull();
  });
});
