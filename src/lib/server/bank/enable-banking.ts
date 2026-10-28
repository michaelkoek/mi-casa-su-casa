import "server-only";
import type { EbTransaction } from "@/lib/bank-mapping";
import { bankEnv } from "../env";
import { bankJwt } from "./crypto";

/*
 * Thin client for the Enable Banking API (https://enablebanking.com/docs/api/reference/).
 * Errors carry only status and error code: never transaction content or session ids.
 */

const BASE = "https://api.enablebanking.com";

export class BankApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(`Enable Banking ${status}${code ? ` ${code}` : ""}`);
  }

  /** The bank consent is gone: the user has to link the bank again. */
  get sessionGone(): boolean {
    return !!this.code && ["EXPIRED_SESSION", "REVOKED_SESSION", "CLOSED_SESSION", "SESSION_DOES_NOT_EXIST"].includes(this.code);
  }

  get rateLimited(): boolean {
    return this.status === 429 || this.code === "ASPSP_RATE_LIMIT_EXCEEDED";
  }
}

/** Headers of the person using the app; with them a request does not count as unattended access. */
export type PsuHeaders = { ip: string; userAgent: string };

type Query = Record<string, string | undefined>;

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, opts: { query?: Query; body?: object; psu?: PsuHeaders } = {}): Promise<T> {
  const env = bankEnv();
  if (!env) throw new BankApiError(0, "NOT_CONFIGURED");
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, v);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${bankJwt(env.ENABLE_BANKING_APP_ID, env.ENABLE_BANKING_PRIVATE_KEY)}`,
  };
  if (opts.body) headers["Content-Type"] = "application/json";
  if (opts.psu) {
    headers["Psu-Ip-Address"] = opts.psu.ip;
    headers["Psu-User-Agent"] = opts.psu.userAgent;
  }
  const res = await fetch(url, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new BankApiError(res.status, typeof err?.error === "string" ? err.error : null);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export type Aspsp = {
  name: string;
  country: string;
  logo?: string;
  beta?: boolean;
  maximum_consent_validity?: number;
};

/** Banks that offer account information to private persons in a country. */
export async function listAspsps(country: string): Promise<Aspsp[]> {
  const res = await call<{ aspsps: Aspsp[] }>("GET", "/aspsps", { query: { country, psu_type: "personal", service: "AIS" } });
  return res.aspsps;
}

/** Starts the consent at the bank; returns the URL to send the user to. */
export async function startAuth(input: { aspsp: { name: string; country: string }; state: string; redirectUrl: string; validUntil: Date }): Promise<string> {
  const res = await call<{ url: string }>("POST", "/auth", {
    body: {
      access: { valid_until: input.validUntil.toISOString() },
      aspsp: input.aspsp,
      state: input.state,
      redirect_url: input.redirectUrl,
      psu_type: "personal",
    },
  });
  return res.url;
}

export type EbAccount = {
  uid: string;
  identification_hash: string;
  account_id?: { iban?: string | null } | null;
  name?: string | null;
  currency?: string | null;
};

export type EbSession = { session_id: string; accounts: EbAccount[]; access: { valid_until: string } };

/** Exchanges the code from the bank redirect for a session with its accounts. */
export function createSession(code: string): Promise<EbSession> {
  return call<EbSession>("POST", "/sessions", { body: { code } });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await call("DELETE", `/sessions/${encodeURIComponent(sessionId)}`);
}

/** All booked transactions since `dateFrom`, following continuation keys. */
export async function fetchTransactions(
  accountUid: string,
  opts: { dateFrom?: string; longest?: boolean; psu?: PsuHeaders },
): Promise<EbTransaction[]> {
  const all: EbTransaction[] = [];
  let continuationKey: string | undefined;
  for (let page = 0; page < 100; page++) {
    const res = await call<{ transactions: EbTransaction[]; continuation_key?: string | null }>(
      "GET",
      `/accounts/${encodeURIComponent(accountUid)}/transactions`,
      {
        query: {
          date_from: opts.dateFrom,
          transaction_status: "BOOK",
          strategy: opts.longest ? "longest" : undefined,
          continuation_key: continuationKey,
        },
        psu: opts.psu,
      },
    );
    all.push(...res.transactions);
    if (!res.continuation_key) break;
    continuationKey = res.continuation_key;
  }
  return all;
}
