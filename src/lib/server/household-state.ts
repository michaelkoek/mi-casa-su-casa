import "server-only";
import { gte } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import * as t from "@/db/schema";
import { emptyRows, fromRows } from "@/lib/sync/rows";
import type { CollectionName, Rows } from "@/lib/sync/collections";
import { shiftMonth, toDateKey } from "@/lib/logic";
import type { BankStatus, HouseholdState } from "@/lib/types";
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

const DROP = new Set(["householdId", "createdAt", "updatedAt", "email", "userId", "mcc"]);

/** Months of history the client gets besides the current one: a twelve-month trend. Older rows stay in the database. */
const HISTORY_MONTHS = 12;

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
  const since = `${shiftMonth(toDateKey(new Date()).slice(0, 7), -HISTORY_MONTHS)}-01`;
  const queries = names.map((c) => {
    const table = TABLES[c];
    const extra = c === "transactions" ? gte(t.transactions.date, since) : undefined;
    return db.select().from(table as PgTable).where(s.where(table, extra));
  });
  const bankQueries = [
    db.select().from(t.bankConnections).where(s.where(t.bankConnections)),
    db.select().from(t.bankAccounts).where(s.where(t.bankAccounts)),
  ];
  const all = (await db.batch([...queries, ...bankQueries] as unknown as [BatchItem<"pg">, ...BatchItem<"pg">[]])) as unknown as Record<
    string,
    unknown
  >[][];
  const results = all.slice(0, names.length);
  const [connections, accounts] = all.slice(names.length) as unknown as [
    (typeof t.bankConnections.$inferSelect)[],
    (typeof t.bankAccounts.$inferSelect)[],
  ];
  const rows = emptyRows() as unknown as Record<CollectionName, unknown[]>;
  names.forEach((c, i) => {
    rows[c] = results[i].map(toRow);
  });
  return fromRows(rows as unknown as Rows, ctx.memberId, bankStatus(connections, accounts));
}

/** Client view of the bank links: no session ids, no account uids. */
function bankStatus(
  connections: (typeof t.bankConnections.$inferSelect)[],
  accounts: (typeof t.bankAccounts.$inferSelect)[],
): BankStatus[] {
  return connections
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((c) => ({
      id: c.id,
      name: c.aspspName,
      status: c.status,
      syncedAt: c.lastSyncedAt?.toISOString() ?? null,
      consentUntil: c.validUntil.toISOString(),
      accounts: accounts
        .filter((a) => a.connectionId === c.id)
        .map((a) => ({ id: a.id, iban: a.iban, name: a.name })),
    }));
}
