import { describe, expect, it } from "vitest";
import * as actions from "../actions";
import { createSeed } from "../seed";
import type { Changeset } from "./collections";
import { applyChangeset, diffState, rebase, revertTo } from "./diff";
import { parseChangeset } from "./schema";

const now = new Date("2026-10-24T14:00:00");
const seed = createSeed(now);

describe("offline queue and replay", () => {
  it("replaying a changeset twice is idempotent (retry after lost response)", () => {
    const next = actions.addTask("Nieuw", "m2", "2026-10-30")(seed);
    const cs = diffState(seed, next);
    const once = applyChangeset(seed, cs);
    expect(applyChangeset(once, cs)).toEqual(once);
  });

  it("rebase of an empty queue returns the server state", () => {
    expect(rebase(seed, [])).toBe(seed);
  });

  it("rebase keeps a pending local edit on top of a newer server state", () => {
    const local = actions.toggleTask("t1", now)(seed);
    const queue: Changeset[] = [{ id: "a", changes: diffState(seed, local) }];
    const server = actions.setBudget("food", 99900)(seed);
    const merged = rebase(server, queue);
    expect(merged.tasks.find((t) => t.id === "t1")?.doneAt).toBeTruthy();
    expect(merged.categories.find((c) => c.id === "food")?.budgetCents).toBe(99900);
  });

  it("an update to a row deleted by the other member is a no-op, not a crash", () => {
    const edit = actions.toggleTask("t1", now)(seed);
    const cs = diffState(seed, edit);
    const server = applyChangeset(seed, [{ op: "delete", c: "tasks", key: "t1" }]);
    const out = applyChangeset(server, cs);
    expect(out.tasks.find((t) => t.id === "t1")).toBeUndefined();
  });

  it("deleting a project removes its materials", () => {
    const out = applyChangeset(seed, [{ op: "delete", c: "projects", key: "p1" }]);
    expect(out.projects.find((p) => p.id === "p1")).toBeUndefined();
    expect(JSON.stringify(out.projects)).not.toContain("mt2");
  });
});

describe("revertTo only reverts own changes", () => {
  it("does not undo the other member's change to the same collection", () => {
    const mine = actions.addTask("Van mij", "m1", "2026-10-30")(seed);
    const other = actions.addTask("Van ander", "m2", "2026-10-31")(mine);
    const undone = revertTo(seed, mine)(other);
    expect(undone.tasks.some((t) => t.title === "Van mij")).toBe(false);
    expect(undone.tasks.some((t) => t.title === "Van ander")).toBe(true);
  });

  it("undo of a no-op leaves the current state untouched", () => {
    const cur = actions.setBudget("food", 1)(seed);
    expect(revertTo(seed, seed)(cur)).toBe(cur);
  });
});

describe("zod validation at the trust boundary", () => {
  const upd = (patch: unknown) => ({
    id: crypto.randomUUID(),
    changes: [{ op: "update", c: "tasks", key: "t1", patch }],
  });

  it("rejects householdId in an update patch and in an insert row", () => {
    expect(parseChangeset(upd({ householdId: "evil" })).ok).toBe(false);
    const ins = diffState(seed, actions.addTask("N", "m1", "2026-10-30")(seed));
    const row = { ...(ins[0] as { row: object }).row, householdId: "evil" };
    expect(parseChangeset({ id: crypto.randomUUID(), changes: [{ ...ins[0], row }] }).ok).toBe(false);
  });

  it.each([null, undefined, 42, "str", [], {}, { id: crypto.randomUUID(), changes: "no" }])(
    "rejects malformed input %j",
    (input) => {
      expect(parseChangeset(input).ok).toBe(false);
    },
  );

  it("accepts a valid update", () => {
    expect(parseChangeset(upd({ doneAt: now.toISOString() })).ok).toBe(true);
  });
});
