import "server-only";
import { desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import * as t from "@/db/schema";
import type { ImportResult } from "@/lib/bank-callback";
import { categoryForMcc, consentDaysLeft, mapEbTransactions, missingStarterRules, normalizeIban } from "@/lib/bank-mapping";
import { addDays, categorize } from "@/lib/logic";
import { bankEnv } from "../env";
import { scope, type HouseholdContext } from "../household";
import { listMembers, sendPushToMembers } from "../push";
import { decrypt, encrypt, stableId } from "./crypto";
import { BankApiError, deleteSession, fetchTransactions, type EbSession, type PsuHeaders } from "./enable-banking";

/* Bank import: stores a new session and pulls booked transactions into the household. */

/** Re-read this many days before the newest stored transaction: banks book late. */
const OVERLAP_DAYS = 5;
const CHUNK = 500;
/** Days before the consent ends that the household gets a push. */
const WARN_DAYS = 7;

/** Stores a fresh session: the connection, its accounts, and starter rules on the first link. Returns the connection id. */
export async function saveSession(
  ctx: HouseholdContext,
  aspsp: { name: string; country: string },
  session: EbSession,
): Promise<string> {
  const env = bankEnv();
  if (!env) throw new BankApiError(0, "NOT_CONFIGURED");
  const s = scope(ctx);
  const id = stableId("bc", `${ctx.householdId}:${session.session_id}`);
  const now = new Date();

  // One live connection per bank: linking again replaces the old one (its accounts move over).
  const sameBank = s.where(
    t.bankConnections,
    eq(t.bankConnections.aspspName, aspsp.name),
    eq(t.bankConnections.aspspCountry, aspsp.country),
  );
  const old = await db.select({ sessionEnc: t.bankConnections.sessionEnc }).from(t.bankConnections).where(sameBank);
  for (const o of old) await closeSession(o.sessionEnc);
  await db.delete(t.bankConnections).where(sameBank);

  await db.insert(t.bankConnections).values({
    householdId: ctx.householdId,
    id,
    aspspName: aspsp.name,
    aspspCountry: aspsp.country,
    sessionEnc: encrypt(session.session_id, env.BANK_TOKEN_KEY),
    validUntil: new Date(session.access.valid_until),
    status: "active",
  });

  for (const a of session.accounts) {
    const row = {
      uid: a.uid,
      connectionId: id,
      iban: a.account_id?.iban ? normalizeIban(a.account_id.iban) : null,
      name: a.name?.slice(0, 100) ?? null,
      updatedAt: now,
    };
    await db
      .insert(t.bankAccounts)
      .values({ householdId: ctx.householdId, id: stableId("a", a.identification_hash), ...row })
      .onConflictDoUpdate({ target: [t.bankAccounts.householdId, t.bankAccounts.id], set: row });
  }

  await addStarterRules(ctx);
  return id;
}

/** Ends a session at Enable Banking; best effort, an already ended session is fine. */
export async function closeSession(sessionEnc: string): Promise<void> {
  const env = bankEnv();
  if (!env) return;
  try {
    await deleteSession(decrypt(sessionEnc, env.BANK_TOKEN_KEY));
  } catch (err) {
    console.error("bank session close failed", err instanceof BankApiError ? err.message : "unknown");
  }
}

async function addStarterRules(ctx: HouseholdContext): Promise<void> {
  const s = scope(ctx);
  const [rules, categories] = await Promise.all([
    db.select({ contains: t.categoryRules.contains }).from(t.categoryRules).where(s.where(t.categoryRules)),
    db.select({ id: t.categories.id }).from(t.categories).where(s.where(t.categories)),
  ]);
  const missing = missingStarterRules(rules, new Set(categories.map((c) => c.id)));
  if (missing.length === 0) return;
  await db
    .insert(t.categoryRules)
    .values(
      missing.map((r, i) => ({
        householdId: ctx.householdId,
        id: stableId("r", `${ctx.householdId}:${r.contains}`),
        contains: r.contains,
        categoryId: r.categoryId,
        position: rules.length + i,
      })),
    )
    .onConflictDoNothing();
}

export type { ImportResult };

/**
 * Imports booked transactions for every account of one connection. New rows are inserted,
 * existing ones left alone, so categories set by hand survive. `psu` is passed when the
 * user is present (refresh button), so the bank does not count it as unattended access.
 */
export async function importConnection(
  ctx: HouseholdContext,
  connectionId: string,
  opts: { psu?: PsuHeaders } = {},
): Promise<ImportResult> {
  const s = scope(ctx);
  const [connection] = await db
    .select()
    .from(t.bankConnections)
    .where(s.where(t.bankConnections, eq(t.bankConnections.id, connectionId)));
  if (!connection) return { status: "error", imported: 0 };

  const [accounts, allAccounts, rules, categories] = await Promise.all([
    db.select().from(t.bankAccounts).where(s.where(t.bankAccounts, eq(t.bankAccounts.connectionId, connectionId))),
    db.select({ iban: t.bankAccounts.iban }).from(t.bankAccounts).where(s.where(t.bankAccounts)),
    db.select().from(t.categoryRules).where(s.where(t.categoryRules)).orderBy(t.categoryRules.position),
    db.select({ id: t.categories.id }).from(t.categories).where(s.where(t.categories)),
  ]);
  const ownIbans = new Set(allAccounts.flatMap((a) => (a.iban ? [a.iban] : [])));
  const categoryIds = new Set(categories.map((c) => c.id));

  let imported = 0;
  try {
    for (const account of accounts) {
      const [latest] = await db
        .select({ date: t.transactions.date })
        .from(t.transactions)
        .where(s.where(t.transactions, eq(t.transactions.accountId, account.id)))
        .orderBy(desc(t.transactions.date))
        .limit(1);
      const raw = await fetchTransactions(account.uid, {
        dateFrom: latest ? addDays(latest.date, -OVERLAP_DAYS) : undefined,
        longest: !latest,
        psu: opts.psu,
      });
      const rows = mapEbTransactions(raw, account.id, ownIbans).map((m) => ({
        householdId: ctx.householdId,
        id: stableId("b", m.externalKey),
        date: m.date,
        counterparty: m.counterparty,
        amountCents: m.amountCents,
        categoryId: m.transfer ? null : (categorize(m, rules) ?? categoryForMcc(m.mcc, categoryIds)),
        source: "bank" as const,
        accountId: account.id,
        description: m.description,
        transfer: m.transfer,
        mcc: m.mcc,
      }));
      for (let i = 0; i < rows.length; i += CHUNK) {
        const inserted = await db
          .insert(t.transactions)
          .values(rows.slice(i, i + CHUNK))
          .onConflictDoNothing()
          .returning({ id: t.transactions.id });
        imported += inserted.length;
      }
    }
    await markConnection(ctx, connectionId, { status: "active", lastSyncedAt: new Date(), lastError: null });
    return { status: "ok", imported };
  } catch (err) {
    const e = err instanceof BankApiError ? err : null;
    console.error("bank import failed", e ? e.message : err instanceof Error ? err.name : "unknown");
    if (e?.sessionGone) {
      await markConnection(ctx, connectionId, { status: "expired", lastError: e.code });
      return { status: "expired", imported };
    }
    if (e?.rateLimited) {
      await markConnection(ctx, connectionId, { lastError: "RATE_LIMITED" });
      return { status: "rate_limited", imported };
    }
    await markConnection(ctx, connectionId, { status: "error", lastError: e?.code ?? "UNKNOWN" });
    return { status: "error", imported };
  }
}

async function markConnection(
  ctx: HouseholdContext,
  connectionId: string,
  set: Partial<Pick<typeof t.bankConnections.$inferInsert, "status" | "lastSyncedAt" | "lastError">>,
): Promise<void> {
  await db
    .update(t.bankConnections)
    .set({ ...set, updatedAt: new Date() })
    .where(scope(ctx).where(t.bankConnections, eq(t.bankConnections.id, connectionId)));
}

/** Imports every connection of a household that is active or failed last time, and warns once when a consent ends soon. */
export async function importHousehold(ctx: HouseholdContext): Promise<ImportResult[]> {
  const s = scope(ctx);
  const connections = await db
    .select()
    .from(t.bankConnections)
    .where(s.where(t.bankConnections, inArray(t.bankConnections.status, ["active", "error"])));
  const results: ImportResult[] = [];
  for (const c of connections) results.push(await importConnection(ctx, c.id));
  await warnExpiring(ctx);
  return results;
}

async function warnExpiring(ctx: HouseholdContext): Promise<void> {
  const s = scope(ctx);
  const now = new Date();
  const soon = new Date(now.getTime() + WARN_DAYS * 24 * 60 * 60 * 1000);
  const expiring = await db
    .select()
    .from(t.bankConnections)
    .where(s.where(t.bankConnections, lt(t.bankConnections.validUntil, soon), isNull(t.bankConnections.expiryWarnedAt)));
  if (expiring.length === 0) return;
  const tr = await getTranslations({ locale: "nl", namespace: "bank.push" });
  const members = await listMembers(ctx);
  for (const c of expiring) {
    const days = Math.max(0, consentDaysLeft(c.validUntil.toISOString(), now));
    try {
      await sendPushToMembers(
        ctx,
        members.map((m) => m.id),
        { title: tr("title", { bank: c.aspspName }), body: tr("body", { days }), url: "/geld", tag: `bank-${c.id}` },
      );
    } catch {
      console.error("bank expiry push failed");
    }
    await db
      .update(t.bankConnections)
      .set({ expiryWarnedAt: now })
      .where(s.where(t.bankConnections, eq(t.bankConnections.id, c.id)));
  }
}

/** Unscoped by design: the cron job finds the households that have a bank link (active or failed last time), then works scoped. */
export async function householdsWithBank(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ householdId: t.bankConnections.householdId })
    .from(t.bankConnections)
    .where(inArray(t.bankConnections.status, ["active", "error"]));
  return rows.map((r) => r.householdId);
}

/** Pending authorisations older than this are dropped. */
const STATE_TTL_MS = 15 * 60 * 1000;

/** Removes the caller's stale pending authorisations. */
export async function pruneAuthStates(ctx: HouseholdContext): Promise<void> {
  await db
    .delete(t.bankAuthStates)
    .where(scope(ctx).where(t.bankAuthStates, lt(t.bankAuthStates.createdAt, new Date(Date.now() - STATE_TTL_MS))));
}

/**
 * Unscoped by design: the bank redirect may arrive without a session (iOS opens it in Safari,
 * which does not share cookies with the PWA). The state is a server-made random uuid, single use
 * (DELETE … RETURNING) and valid for 15 minutes; the household comes from this row, never from the client.
 */
export async function takeAuthStateUnscoped(
  state: string,
): Promise<{ householdId: string; name: string; country: string } | null> {
  const [row] = await db.delete(t.bankAuthStates).where(eq(t.bankAuthStates.state, state)).returning();
  if (!row || Date.now() - row.createdAt.getTime() > STATE_TTL_MS) return null;
  return { householdId: row.householdId, name: row.aspspName, country: row.aspspCountry };
}

/** Records a pending authorisation for this household; returns the state to send along. */
export async function createAuthState(ctx: HouseholdContext, aspsp: { name: string; country: string }): Promise<string> {
  await pruneAuthStates(ctx);
  const [row] = await db
    .insert(t.bankAuthStates)
    .values({ householdId: ctx.householdId, aspspName: aspsp.name, aspspCountry: aspsp.country })
    .returning({ state: t.bankAuthStates.state });
  return row.state;
}

/** Connections worth importing: active, or failed last time (retried, since the import is idempotent). */
export async function activeConnections(ctx: HouseholdContext) {
  return db
    .select({ id: t.bankConnections.id, lastSyncedAt: t.bankConnections.lastSyncedAt })
    .from(t.bankConnections)
    .where(scope(ctx).where(t.bankConnections, inArray(t.bankConnections.status, ["active", "error"])));
}

/** Ends the consent at the bank and removes the link; imported transactions stay. False when not found. */
export async function removeConnection(ctx: HouseholdContext, connectionId: string): Promise<boolean> {
  const where = scope(ctx).where(t.bankConnections, eq(t.bankConnections.id, connectionId));
  const [connection] = await db.select({ sessionEnc: t.bankConnections.sessionEnc }).from(t.bankConnections).where(where);
  if (!connection) return false;
  await closeSession(connection.sessionEnc);
  await db.delete(t.bankConnections).where(where);
  return true;
}
