import "server-only";
import type { BatchItem } from "drizzle-orm/batch";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import * as t from "@/db/schema";
import { emptyRows, fromRows } from "@/lib/sync/rows";
import type { CollectionName, Rows } from "@/lib/sync/collections";
import type { HouseholdState } from "@/lib/types";
import { scope, type HouseholdContext, type HouseholdTable } from "./household";

/** Collection -> table. Shared with apply-changes. */
export const TABLES: Record<CollectionName, HouseholdTable> = {
  members: t.members,
  signals: t.signals,
  chores: t.chores,
  tasks: t.tasks,
  projects: t.projects,
  materials: t.materials,
  categories: t.categories,
  transactions: t.transactions,
  rules: t.categoryRules,
  care: t.careDays,
  medicines: t.medicines,
  doses: t.doses,
  temperatures: t.temperatures,
  appointments: t.appointments,
  routine: t.routineItems,
  milestones: t.milestones,
  sizes: t.clothingSizes,
  stock: t.stockItems,
  growth: t.growthEntries,
  foods: t.foodTries,
  recipes: t.recipes,
  mealPlan: t.mealPlan,
  shopping: t.shoppingItems,
  events: t.calendarEvents,
};

const DROP = new Set(["householdId", "createdAt", "updatedAt", "email", "userId"]);

function toRow(raw: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!DROP.has(k)) row[k] = v instanceof Date ? v.toISOString() : v;
  }
  return row;
}

/** Reads the whole household in one batch of scoped selects. */
export async function loadHouseholdState(ctx: HouseholdContext): Promise<HouseholdState> {
  const names = Object.keys(TABLES) as CollectionName[];
  const s = scope(ctx);
  const queries = names.map((c) => {
    const table = TABLES[c];
    return db.select().from(table as PgTable).where(s.where(table));
  });
  const results = (await db.batch(queries as unknown as [BatchItem<"pg">, ...BatchItem<"pg">[]])) as unknown as Record<
    string,
    unknown
  >[][];
  const rows = emptyRows() as unknown as Record<CollectionName, unknown[]>;
  names.forEach((c, i) => {
    rows[c] = results[i].map(toRow);
  });
  return fromRows(rows as unknown as Rows, ctx.memberId, null);
}
