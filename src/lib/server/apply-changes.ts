import "server-only";
import { eq, inArray, ne } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { categoryRules, members, transactions } from "@/db/schema";
import { BANK_LOCKED_FIELDS, COLLECTIONS, type Change, type Changeset } from "@/lib/sync/collections";
import { orderChanges } from "@/lib/sync/diff";
import { bankRowIssues, memberRefIssues, transactionKeys } from "@/lib/sync/schema";
import { TABLES } from "./household-state";
import { scope, type HouseholdContext } from "./household";

type Result = { ok: true } | { ok: false; error: "invalid" | "conflict" | "server" };

type Data = Record<string, unknown>;

/** ISO strings become Dates for timestamptz columns. */
function convert(c: Change["c"], data: Data): Data {
  const out: Data = { ...data };
  for (const f of COLLECTIONS[c].timestamps) {
    if (typeof out[f] === "string") out[f] = new Date(out[f] as string);
  }
  return out;
}

function keyValue(c: Change["c"], key: string): string | number {
  return c === "care" ? Number(key) : key;
}

function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: unknown } | undefined;
  return e?.code ?? (e?.cause ? pgCode(e.cause) : undefined);
}

/** Validates member references, then writes a parsed changeset atomically. All queries are scoped. */
export async function writeChangeset(ctx: HouseholdContext, cs: Changeset): Promise<Result> {
  const s = scope(ctx);
  try {
    const memberRows = await db.select({ id: members.id }).from(members).where(s.where(members));
    if (memberRefIssues(cs.changes, new Set(memberRows.map((m) => m.id))).length > 0) {
      return { ok: false, error: "invalid" };
    }

    // The bank owns its rows: reject any change to amount, date or description, any delete, any overwrite.
    const keys = transactionKeys(cs.changes);
    if (keys.length > 0) {
      const stored = await db
        .select({ id: transactions.id, source: transactions.source })
        .from(transactions)
        .where(s.where(transactions, inArray(transactions.id, keys)));
      const bankIds = new Set(stored.filter((r) => r.source === "bank").map((r) => r.id));
      if (bankRowIssues(cs.changes, bankIds).length > 0) return { ok: false, error: "invalid" };
    }

    const now = new Date();
    // Defense in depth: even if the lookup raced with an import, SQL never touches a bank row's locked fields.
    const notBank = ne(transactions.source, "bank");
    const stmts = orderChanges(cs.changes).flatMap((ch): unknown[] => {
      const table = TABLES[ch.c];
      const keyName = COLLECTIONS[ch.c].key;
      const col = (table as unknown as Record<string, PgColumn>)[keyName];
      const isTx = ch.c === "transactions";
      if (ch.op === "insert") {
        const row = convert(ch.c, ch.row as unknown as Data);
        const { [keyName]: _key, ...rest } = row;
        void _key;
        return [
          db
            .insert(table)
            .values({ ...row, householdId: ctx.householdId })
            .onConflictDoUpdate({
              target: [(table as unknown as Record<string, PgColumn>).householdId, col],
              set: { ...rest, updatedAt: now },
              ...(isTx ? { setWhere: notBank } : {}),
            }),
        ];
      }
      if (ch.op === "update") {
        const locked = isTx && BANK_LOCKED_FIELDS.some((f) => f in (ch.patch as object));
        return [
          db
            .update(table)
            .set({ ...convert(ch.c, ch.patch as unknown as Data), updatedAt: now })
            .where(s.where(table, eq(col, keyValue(ch.c, ch.key)), locked ? notBank : undefined)),
        ];
      }
      if (ch.c === "categories") {
        // The client only holds recent transactions: null the rest here so the foreign keys never block.
        return [
          db
            .update(transactions)
            .set({ categoryId: null, updatedAt: now })
            .where(s.where(transactions, eq(transactions.categoryId, ch.key))),
          db.delete(categoryRules).where(s.where(categoryRules, eq(categoryRules.categoryId, ch.key))),
          db.delete(table).where(s.where(table, eq(col, ch.key))),
        ];
      }
      return [db.delete(table).where(s.where(table, eq(col, keyValue(ch.c, ch.key)), isTx ? notBank : undefined))];
    });

    await db.batch(stmts as unknown as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
    return { ok: true };
  } catch (err) {
    const code = pgCode(err);
    if (code === "23503" || code === "23514") return { ok: false, error: "conflict" };
    console.error("writeChangeset failed", code ?? (err instanceof Error ? err.name : "unknown"));
    return { ok: false, error: "server" };
  }
}
