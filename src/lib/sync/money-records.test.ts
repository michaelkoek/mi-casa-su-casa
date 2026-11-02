import { describe, expect, it } from "vitest";
import * as actions from "../actions";
import { createSeed } from "../seed";
import type { Change } from "./collections";
import { diffState, orderChanges, revertTo } from "./diff";
import { parseChangeset } from "./schema";

const now = new Date("2026-10-24T14:00:00");
const seed = createSeed(now);
const cs = (changes: Change[]) => ({ id: crypto.randomUUID(), changes });
const tags = (changes: Change[]) => changes.map((c) => `${c.op}:${c.c}`);

describe("removeCategory", () => {
  const next = actions.removeCategory("food")(seed);

  it("forward changeset updates transactions, then deletes rules, then the category", () => {
    const forward = orderChanges(diffState(seed, next));
    expect(parseChangeset(cs(forward)).ok).toBe(true);
    const t = tags(forward);
    const lastUpdate = t.lastIndexOf("update:transactions");
    expect(lastUpdate).toBeGreaterThanOrEqual(0);
    expect(lastUpdate).toBeLessThan(t.indexOf("delete:rules"));
    expect(t.lastIndexOf("delete:rules")).toBeLessThan(t.indexOf("delete:categories"));
  });

  it("undo inserts the category before its rules and restores everything", () => {
    const restored = revertTo(seed, next)(next);
    const undo = orderChanges(diffState(next, restored));
    expect(parseChangeset(cs(undo)).ok).toBe(true);
    const t = tags(undo);
    expect(t.indexOf("insert:categories")).toBeLessThan(t.indexOf("insert:rules"));
    expect(restored.categories).toEqual(seed.categories);
    expect(restored.rules).toEqual(seed.rules);
    expect([...restored.transactions].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...seed.transactions].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });
});

describe("manual transactions", () => {
  const withManual = actions.addExpense(1250, "Bakker", "food", now, "xm1")(seed);

  it("edit changeset (amount and date) and its undo parse", () => {
    const edited = actions.updateTransaction("xm1", { amountCents: 2000, date: "2026-10-01" })(withManual);
    for (const changes of [diffState(withManual, edited), diffState(edited, withManual)]) {
      expect(changes.length).toBeGreaterThan(0);
      expect(parseChangeset(cs(changes)).ok).toBe(true);
    }
  });

  it("delete changeset parses and its undo re-inserts a manual row", () => {
    const removed = actions.removeTransaction("xm1")(withManual);
    expect(parseChangeset(cs(diffState(withManual, removed))).ok).toBe(true);
    const undo = diffState(removed, withManual);
    expect(parseChangeset(cs(undo)).ok).toBe(true);
    const ins = undo.find((c) => c.op === "insert" && c.c === "transactions");
    expect(ins && ins.op === "insert" && (ins.row as { source: string }).source).toBe("manual");
  });
});

describe("rules with surrounding spaces", () => {
  const spaced = { ...seed, rules: [...seed.rules, { id: "rplus", contains: "plus ", categoryId: "food" }] };

  it("undo of removeRule keeps the trailing space through parseChangeset", () => {
    const next = actions.removeRule("rplus")(spaced);
    const restored = revertTo(spaced, next)(next);
    const undo = orderChanges(diffState(next, restored));
    const parsed = parseChangeset(cs(undo));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.changes[0]).toMatchObject({ op: "insert", c: "rules", row: { contains: "plus " } });
  });

  it("undo of removeCategory keeps it too", () => {
    const next = actions.removeCategory("food")(spaced);
    const undo = orderChanges(diffState(next, revertTo(spaced, next)(next)));
    const parsed = parseChangeset(cs(undo));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const ins = parsed.value.changes.find((c) => c.op === "insert" && c.c === "rules" && (c.row as { id: string }).id === "rplus");
    expect(ins).toMatchObject({ row: { contains: "plus " } });
  });

  it("update patch keeps spaces; whitespace-only is rejected for insert and patch", () => {
    const patch = (contains: string) => parseChangeset(cs([{ op: "update", c: "rules", key: "rplus", patch: { contains } } as unknown as Change]));
    const p = patch("plus ");
    expect(p.ok && p.value.changes[0]).toMatchObject({ patch: { contains: "plus " } });
    expect(patch("   ").ok).toBe(false);
    expect(patch("").ok).toBe(false);
    const row = { id: "rx", contains: "  ", categoryId: "food", position: 0 };
    expect(parseChangeset(cs([{ op: "insert", c: "rules", row } as unknown as Change])).ok).toBe(false);
  });
});
