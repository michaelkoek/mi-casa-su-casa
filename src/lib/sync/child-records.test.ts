import { describe, expect, it } from "vitest";
import * as actions from "../actions";
import { createSeed } from "../seed";
import { COLLECTIONS, type Change } from "./collections";
import { applyChangeset, diffState, orderChanges, revertTo } from "./diff";
import { parseChangeset } from "./schema";

const now = new Date("2026-10-24T14:00:00");
const seed = createSeed(now);
const cs = (changes: Change[]) => ({ id: crypto.randomUUID(), changes });
const tags = (changes: Change[]) => changes.map((c) => `${c.op}:${c.c}`);

describe("widened collections", () => {
  it("allow all ops for routine, medicines, sizes and stock", () => {
    for (const c of ["routine", "medicines", "sizes", "stock"] as const) {
      expect(COLLECTIONS[c].ops, c).toEqual(["insert", "update", "delete"]);
    }
  });

  const cases: [string, (s: typeof seed) => typeof seed][] = [
    ["addRoutine", actions.addRoutine({ time: "10:00", label: "Fruit" })],
    ["removeRoutine", actions.removeRoutine("rt1")],
    ["addSize", actions.addSize({ label: "Muts", size: "48", note: null })],
    ["removeSize", actions.removeSize("z1")],
    ["addStock", actions.addStock("Zeep")],
    ["removeStock", actions.removeStock("st1")],
    ["updateMedicine", actions.updateMedicine("para", { name: "Dafalgan", intervalHours: 4 })],
  ];
  for (const [name, fn] of cases) {
    it(`${name}: changeset is valid and its undo is valid and restores state`, () => {
      const next = fn(seed);
      const forward = diffState(seed, next);
      expect(parseChangeset(cs(forward)).ok, name).toBe(true);
      const undo = diffState(next, revertTo(seed, next)(next));
      expect(parseChangeset(cs(undo)).ok, `${name} undo`).toBe(true);
      expect(revertTo(seed, next)(next).routine).toEqual(seed.routine);
      expect(revertTo(seed, next)(next).sizes).toEqual(seed.sizes);
      expect(revertTo(seed, next)(next).stock).toEqual(seed.stock);
      expect(revertTo(seed, next)(next).medicines).toEqual(seed.medicines);
    });
  }

  it("still rejects deletes on events (no ops allowed)", () => {
    expect(parseChangeset(cs([{ op: "delete", c: "events", key: "e1" }])).ok).toBe(false);
  });
});

describe("removeMedicine with doses", () => {
  const withDoses = actions.addDose("para", "x", "m1", now)(seed);
  const hasDoses = withDoses.doses.some((d) => d.medicineId === "para");
  const after = actions.removeMedicine("para")(withDoses);

  it("seed precondition: para has doses", () => {
    expect(hasDoses).toBe(true);
  });

  it("deletes doses before the medicine", () => {
    const ordered = tags(orderChanges(diffState(withDoses, after)));
    const firstMed = ordered.indexOf("delete:medicines");
    const lastDose = ordered.lastIndexOf("delete:doses");
    expect(firstMed).toBeGreaterThan(-1);
    expect(lastDose).toBeGreaterThan(-1);
    expect(lastDose).toBeLessThan(firstMed);
  });

  it("undo inserts the medicine before its doses and restores both", () => {
    const undo = diffState(after, revertTo(withDoses, after)(after));
    const ordered = tags(orderChanges(undo));
    expect(ordered.indexOf("insert:medicines")).toBeGreaterThan(-1);
    expect(ordered.indexOf("insert:medicines")).toBeLessThan(ordered.indexOf("insert:doses"));
    expect(parseChangeset(cs(undo)).ok).toBe(true);
    const restored = applyChangeset(after, undo);
    expect(restored.medicines.map((m) => m.id).sort()).toEqual(withDoses.medicines.map((m) => m.id).sort());
    expect(restored.doses.map((d) => d.id).sort()).toEqual(withDoses.doses.map((d) => d.id).sort());
  });
});
