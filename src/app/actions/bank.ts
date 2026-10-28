"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { consentValidUntil } from "@/lib/bank-mapping";
import { BankApiError, listAspsps, startAuth, type PsuHeaders } from "@/lib/server/bank/enable-banking";
import { activeConnections, createAuthState, importConnection, removeConnection } from "@/lib/server/bank/import";
import { bankEnv, baseUrl } from "@/lib/server/env";
import { requireHouseholdForAction } from "@/lib/server/household";

const COUNTRY = "NL";
/** The refresh button imports at most this often per bank: the bank limits access too. */
const REFRESH_MIN_MS = 10 * 60 * 1000;

type Fail = { ok: false; error: "unauthorized" | "unavailable" | "failed" };

export type BankOption = { name: string; logo: string | null; beta: boolean };

/** Dutch banks that offer account information to private persons. */
export async function listBanks(): Promise<{ ok: true; banks: BankOption[] } | Fail> {
  const ctx = await requireHouseholdForAction();
  if (!ctx) return { ok: false, error: "unauthorized" };
  if (!bankEnv()) return { ok: false, error: "unavailable" };
  try {
    const aspsps = await listAspsps(COUNTRY);
    const banks = aspsps
      .map((a) => ({ name: a.name, logo: a.logo ?? null, beta: !!a.beta }))
      .sort((a, b) => a.name.localeCompare(b.name, "nl"));
    return { ok: true, banks };
  } catch (err) {
    console.error("listBanks failed", err instanceof BankApiError ? err.message : "unknown");
    return { ok: false, error: "failed" };
  }
}

/** Starts linking a bank; the client sends the user to the returned URL. */
export async function startBankLink(input: unknown): Promise<{ ok: true; url: string } | Fail> {
  const ctx = await requireHouseholdForAction();
  if (!ctx) return { ok: false, error: "unauthorized" };
  if (!bankEnv()) return { ok: false, error: "unavailable" };
  const parsed = z.object({ name: z.string().min(1).max(100) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "failed" };
  try {
    const aspsp = (await listAspsps(COUNTRY)).find((a) => a.name === parsed.data.name);
    if (!aspsp) return { ok: false, error: "failed" };
    const state = await createAuthState(ctx, { name: aspsp.name, country: aspsp.country });
    const url = await startAuth({
      aspsp: { name: aspsp.name, country: aspsp.country },
      state,
      redirectUrl: `${await origin()}/api/bank/callback`,
      validUntil: consentValidUntil(new Date(), aspsp.maximum_consent_validity),
    });
    return { ok: true, url };
  } catch (err) {
    console.error("startBankLink failed", err instanceof BankApiError ? err.message : "unknown");
    return { ok: false, error: "failed" };
  }
}

/** Imports new transactions now, for every active bank that was not refreshed in the last minutes. */
export async function refreshBank(): Promise<{ ok: true; imported: number; expired: boolean } | Fail> {
  const ctx = await requireHouseholdForAction();
  if (!ctx) return { ok: false, error: "unauthorized" };
  if (!bankEnv()) return { ok: false, error: "unavailable" };
  const connections = await activeConnections(ctx);
  const psu = await psuHeaders();
  let imported = 0;
  let expired = false;
  let failed = false;
  for (const c of connections) {
    if (c.lastSyncedAt && Date.now() - c.lastSyncedAt.getTime() < REFRESH_MIN_MS) continue;
    const result = await importConnection(ctx, c.id, { psu });
    imported += result.imported;
    expired ||= result.status === "expired";
    failed ||= result.status === "error";
  }
  if (failed) return { ok: false, error: "failed" };
  return { ok: true, imported, expired };
}

/** Removes a bank link; imported transactions stay. */
export async function unlinkBank(input: unknown): Promise<{ ok: true } | Fail> {
  const ctx = await requireHouseholdForAction();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const parsed = z.object({ id: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "failed" };
  return (await removeConnection(ctx, parsed.data.id)) ? { ok: true } : { ok: false, error: "failed" };
}

/** Where the bank sends the user back to: this deployment, as the browser sees it. */
async function origin(): Promise<string> {
  const h = await headers();
  const o = h.get("origin");
  return o && /^https?:\/\/[^/]+$/.test(o) ? o : baseUrl();
}

async function psuHeaders(): Promise<PsuHeaders | undefined> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = h.get("user-agent");
  return ip && userAgent ? { ip, userAgent: userAgent.slice(0, 300) } : undefined;
}
