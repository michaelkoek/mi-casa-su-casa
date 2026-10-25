import "server-only";
import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { members } from "@/db/schema";
import { COLLECTIONS, type Change, type Changeset } from "@/lib/sync/collections";
import { orderChanges } from "@/lib/sync/diff";
import { memberRefIssues } from "@/lib/sync/schema";
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

    const now = new Date();
    const stmts = orderChanges(cs.changes).map((ch) => {
      const table = TABLES[ch.c];
      const keyName = COLLECTIONS[ch.c].key;
      const col = (table as unknown as Record<string, PgColumn>)[keyName];
      if (ch.op === "insert") {
        const row = convert(ch.c, ch.row as unknown as Data);
        const { [keyName]: _key, ...rest } = row;
        void _key;
        return db
          .insert(table)
          .values({ ...row, householdId: ctx.householdId })
          .onConflictDoUpdate({
            target: [(table as unknown as Record<string, PgColumn>).householdId, col],
            set: { ...rest, updatedAt: now },
          });
      }
      if (ch.op === "update") {
        return db
          .update(table)
          .set({ ...convert(ch.c, ch.patch as unknown as Data), updatedAt: now })
          .where(s.where(table, eq(col, keyValue(ch.c, ch.key))));
      }
      return db.delete(table).where(s.where(table, eq(col, keyValue(ch.c, ch.key))));
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
