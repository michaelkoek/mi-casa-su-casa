import "server-only";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { members } from "@/db/schema";
import { auth } from "@/lib/auth";

/*
 * Data-access entry point. The household comes from the session only; nothing the
 * client sends is trusted. Every query on a household table goes through scope().
 */

export type HouseholdContext = { userId: string; email: string; householdId: string; memberId: string };

export type AuthState =
  | { status: "anonymous" }
  | { status: "no-member"; email: string }
  | { status: "member"; ctx: HouseholdContext };

export type HouseholdTable = PgTable & { householdId: PgColumn };

export const getAuthState = cache(async (): Promise<AuthState> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: "anonymous" };
  const { id: userId, email } = session.user;

  const find = async () => {
    // Unscoped by design: this is how the household is found from the user.
    const [row] = await db
      .select({ householdId: members.householdId, memberId: members.id })
      .from(members)
      .where(eq(members.userId, userId))
      .limit(1);
    return row;
  };

  let row = await find();
  if (!row) {
    // First login: link the user to the member with this email.
    await db
      .update(members)
      .set({ userId })
      .where(and(eq(members.email, email.toLowerCase()), isNull(members.userId)));
    row = await find();
  }
  if (!row) return { status: "no-member", email };
  return { status: "member", ctx: { userId, email, householdId: row.householdId, memberId: row.memberId } };
});

export async function getHouseholdContext(): Promise<HouseholdContext | null> {
  const state = await getAuthState();
  return state.status === "member" ? state.ctx : null;
}

/** For pages and layouts: redirects to /login when there is no member session. */
export async function requireHousehold(): Promise<HouseholdContext> {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** For server actions: never redirects, the caller reports "unauthorized". */
export async function requireHouseholdForAction(): Promise<HouseholdContext | null> {
  return getHouseholdContext();
}

/** Unscoped lookup by email; used only by the auth instance to decide who may log in. */
export async function isMemberEmail(email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.email, email.trim().toLowerCase()))
    .limit(1);
  return !!row;
}

/** The only way to build a WHERE clause for a household table. */
export function scope(ctx: HouseholdContext) {
  return {
    householdId: ctx.householdId,
    where(table: HouseholdTable, ...conds: (SQL | undefined)[]): SQL {
      return and(eq(table.householdId, ctx.householdId), ...conds) ?? sql`false`;
    },
  };
}
