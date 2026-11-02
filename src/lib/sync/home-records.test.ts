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

describe("removeProject", () => {
  const next = actions.removeProject("p1")(seed);

  it("forward changeset parses and deletes materials before the project", () => {
    const forward = orderChanges(diffState(seed, next));
    expect(parseChangeset(cs(forward)).ok).toBe(true);
    const t = tags(forward);
    const lastMaterial = t.lastIndexOf("delete:materials");
    expect(lastMaterial).toBeGreaterThanOrEqual(0);
    expect(lastMaterial).toBeLessThan(t.indexOf("delete:projects"));
  });

  it("undo inserts the project before its materials and restores everything", () => {
    const restored = revertTo(seed, next)(next);
    const undo = orderChanges(diffState(next, restored));
    expect(parseChangeset(cs(undo)).ok).toBe(true);
    const t = tags(undo);
    expect(t.indexOf("insert:projects")).toBeLessThan(t.indexOf("insert:materials"));
    expect(restored.projects).toEqual(seed.projects);
    expect(restored.projects[0].materials).toHaveLength(3);
  });
});

describe("updateTask", () => {
  it("moving the due date patches exactly due and dueLabel", () => {
    const next = actions.updateTask("t3", { due: "2026-12-01" })(seed);
    const changes = diffState(seed, next);
    expect(changes).toHaveLength(1);
    const c = changes[0];
    expect(c.op).toBe("update");
    if (c.op === "update") expect(Object.keys(c.patch).sort()).toEqual(["due", "dueLabel"]);
    expect(parseChangeset(cs(changes)).ok).toBe(true);
  });
});

describe("removeMaterial", () => {
  it("is one material delete plus position-only updates", () => {
    const next = actions.removeMaterial("p1", "mt1")(seed);
    const changes = diffState(seed, next);
    expect(changes.filter((c) => c.op === "delete")).toHaveLength(1);
    expect(tags(changes).filter((x) => x === "delete:materials")).toHaveLength(1);
    for (const c of changes) {
      if (c.op === "update") expect(Object.keys(c.patch)).toEqual(["position"]);
    }
    expect(parseChangeset(cs(changes)).ok).toBe(true);
  });
});
