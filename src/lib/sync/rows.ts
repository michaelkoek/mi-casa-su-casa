import { COLLECTION_NAMES, rowKey, type CollectionName, type Rows } from "./collections";
import type { BankStatus, HomeProject, HouseholdState, MemberId } from "../types";

/* Conversion between the nested HouseholdState and flat per-collection rows. Pure. */

const withPosition = <T extends object>(items: T[]) => items.map((item, position) => ({ ...item, position }));

const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Flattens the state into rows; position = array index, materials get their project id. */
export function toRows(s: HouseholdState): Rows {
  return {
    members: withPosition(s.members),
    signals: withPosition(s.signals),
    chores: withPosition(s.chores),
    tasks: withPosition(s.tasks),
    projects: withPosition(
      s.projects.map((p) => {
        const row: Record<string, unknown> = { ...p };
        delete row.materials;
        return row as Omit<HomeProject, "materials">;
      }),
    ),
    materials: s.projects.flatMap((p) => withPosition(p.materials).map((m) => ({ ...m, projectId: p.id }))),
    categories: withPosition(s.categories),
    transactions: withPosition(s.transactions),
    rules: withPosition(s.rules),
    care: [...s.care].sort((a, b) => a.weekday - b.weekday),
    medicines: withPosition(s.medicines),
    doses: withPosition(s.doses),
    temperatures: withPosition(s.temperatures),
    appointments: withPosition(s.appointments),
    routine: withPosition(s.routine),
    milestones: withPosition(s.milestones),
    sizes: withPosition(s.sizes),
    stock: withPosition(s.stock),
    growth: withPosition(s.growth),
    foods: withPosition(s.foods),
    recipes: withPosition(s.recipes),
    mealPlan: [...s.mealPlan].sort((a, b) => byKey(a.date, b.date)),
    shopping: withPosition(s.shopping),
    events: withPosition(s.events),
  };
}

/** Sorts a collection by position (then key) and drops the position field. */
function ordered<C extends CollectionName>(c: C, rows: Rows[C]): Omit<Rows[C][number], "position">[] {
  return [...rows]
    .sort((a, b) => {
      const d = (a as { position: number }).position - (b as { position: number }).position;
      return d !== 0 ? d : byKey(rowKey(c, a), rowKey(c, b));
    })
    .map((row) => {
      const copy = { ...row } as Record<string, unknown>;
      delete copy.position;
      return copy;
    }) as Omit<Rows[C][number], "position">[];
}

/** Rebuilds the nested state from rows. `me` and `bank` are not stored as rows. */
export function fromRows(rows: Rows, me: MemberId, bank: BankStatus | null): HouseholdState {
  const o = <C extends CollectionName>(c: C) => ordered(c, rows[c]);
  const materials = o("materials");
  return {
    version: 1,
    me,
    members: o("members"),
    signals: o("signals"),
    chores: o("chores"),
    tasks: o("tasks"),
    projects: o("projects").map((p) => ({
      ...p,
      materials: materials
        .filter((m) => m.projectId === p.id)
        .map((m) => ({ id: m.id, name: m.name, bought: m.bought })),
    })),
    categories: o("categories"),
    transactions: o("transactions"),
    rules: o("rules"),
    bank,
    care: [...rows.care].sort((a, b) => a.weekday - b.weekday),
    medicines: o("medicines"),
    doses: o("doses"),
    temperatures: o("temperatures"),
    appointments: o("appointments"),
    routine: o("routine"),
    milestones: o("milestones"),
    sizes: o("sizes"),
    stock: o("stock"),
    growth: o("growth"),
    foods: o("foods"),
    recipes: o("recipes"),
    mealPlan: [...rows.mealPlan].sort((a, b) => byKey(a.date, b.date)),
    shopping: o("shopping"),
    events: o("events"),
  };
}

/** Empty row set, for tests and the loader. */
export function emptyRows(): Rows {
  return Object.fromEntries(COLLECTION_NAMES.map((c) => [c, []])) as unknown as Rows;
}
