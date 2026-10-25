import {
  COLLECTION_NAMES,
  COLLECTIONS,
  WRITE_ORDER,
  rowKey,
  type Change,
  type Changeset,
  type CollectionName,
  type Rows,
} from "./collections";
import { fromRows, toRows } from "./rows";
import type { HouseholdState } from "../types";

/* Row-level diffing between two household states. Pure. */

type AnyRow = Record<string, unknown>;

const same = (a: unknown, b: unknown) => (a === b ? true : JSON.stringify(a) === JSON.stringify(b));

/** Field-level changes that turn `prev` into `next`. Ignores `me`, `bank` and `version`. */
export function diffState(prev: HouseholdState, next: HouseholdState): Change[] {
  const a = toRows(prev);
  const b = toRows(next);
  const changes: Change[] = [];
  for (const c of COLLECTION_NAMES) {
    const before = new Map((a[c] as AnyRow[]).map((r) => [rowKey(c, r), r]));
    const after = new Map((b[c] as AnyRow[]).map((r) => [rowKey(c, r), r]));
    const keyField = COLLECTIONS[c].key;
    for (const [key, row] of after) {
      const old = before.get(key);
      if (!old) {
        changes.push({ op: "insert", c, row } as Change);
        continue;
      }
      const patch: AnyRow = {};
      for (const field of Object.keys(row)) {
        if (field !== keyField && !same(old[field], row[field])) patch[field] = row[field];
      }
      if (Object.keys(patch).length > 0) changes.push({ op: "update", c, key, patch } as Change);
    }
    for (const key of before.keys()) {
      if (!after.has(key)) changes.push({ op: "delete", c, key });
    }
  }
  return changes;
}

/** Applies changes to a state. Insert = upsert by key; update/delete on a missing row = no-op. */
export function applyChangeset(s: HouseholdState, changes: Change[]): HouseholdState {
  if (changes.length === 0) return s;
  const rows = toRows(s) as unknown as Record<CollectionName, AnyRow[]>;
  for (const change of changes) {
    const list = rows[change.c];
    const keyOf = (r: AnyRow) => rowKey(change.c, r);
    const key = change.op === "insert" ? keyOf(change.row as AnyRow) : change.key;
    const i = list.findIndex((r) => keyOf(r) === key);
    if (change.op === "insert") {
      if (i >= 0) list[i] = { ...(change.row as AnyRow) };
      else list.push({ ...(change.row as AnyRow) });
    } else if (change.op === "update") {
      if (i >= 0) list[i] = { ...list[i], ...(change.patch as AnyRow) };
    } else if (i >= 0) {
      list.splice(i, 1);
      if (change.c === "projects") rows.materials = rows.materials.filter((m) => m.projectId !== key);
    }
  }
  return fromRows(rows as unknown as Rows, s.me, s.bank);
}

/** Undo: reverts only what `before` → `after` changed, on top of whatever the state is now. */
export function revertTo(before: HouseholdState, after: HouseholdState): (cur: HouseholdState) => HouseholdState {
  return (cur) => applyChangeset(cur, diffState(after, before));
}

/** Server state plus the still-pending local changesets, in order. */
export function rebase(server: HouseholdState, queue: Changeset[]): HouseholdState {
  return queue.reduce((state, cs) => applyChangeset(state, cs.changes), server);
}

/** Inserts by WRITE_ORDER, then updates by WRITE_ORDER, then deletes by reverse WRITE_ORDER. */
export function orderChanges(changes: Change[]): Change[] {
  const rank = (c: CollectionName) => WRITE_ORDER.indexOf(c);
  const pick = (op: Change["op"]) => changes.filter((x) => x.op === op);
  const stable = (list: Change[], dir: 1 | -1) =>
    list
      .map((x, i) => ({ x, i }))
      .sort((p, q) => dir * (rank(p.x.c) - rank(q.x.c)) || p.i - q.i)
      .map((e) => e.x);
  return [...stable(pick("insert"), 1), ...stable(pick("update"), 1), ...stable(pick("delete"), -1)];
}
