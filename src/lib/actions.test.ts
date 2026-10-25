import { describe, expect, it } from "vitest";
import {
  categorizeTransaction,
  claimCare,
  cycleStock,
  cycleCare,
  materialsToShopping,
  recipeToShopping,
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
    const noRule = categorizeTransaction("x13", "child", false)(s);
    expect(noRule.rules).toHaveLength(s.rules.length);
  });

  it("adds missing recipe ingredients without duplicates", () => {
    const s = createSeed(now);
    const next = recipeToShopping("rc1")(s);
    const names = next.shopping.filter((i) => !i.checked).map((i) => i.name);
    expect(names.filter((n) => n === "Flespompoen")).toHaveLength(1);
    expect(names).toContain("Parmezaan");
    expect(names).toContain("Penne"); // the checked one counts as bought, so it goes back on the list
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
