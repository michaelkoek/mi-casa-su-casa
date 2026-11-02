import "server-only";
import type { LightChange, LightKind } from "@/lib/lights";
import { retryWhileLimited, shellyCommand } from "@/lib/lights";

/* Shelly Cloud Control API v2. The limit is one call per second, per account. */

export type ShellyCredentials = { host: string; authKey: string };
export type ShellyDeviceState = { id: string; online?: unknown; status?: Record<string, unknown> };

const IDS_PER_CALL = 10;
const PACE_MS = 1100;

/** Carries only the status: the URL holds the auth key and must never reach a log. */
export class ShellyError extends Error {
  constructor(readonly status: number) {
    super(`Shelly API ${status}`);
  }
  get unauthorized() {
    return this.status === 401 || this.status === 403;
  }
}

const pause = () => new Promise<void>((r) => setTimeout(r, PACE_MS));

function post(creds: ShellyCredentials, path: string, body: unknown): Promise<unknown> {
  return retryWhileLimited(() => postOnce(creds, path, body), (err) => err instanceof ShellyError && err.status === 429, pause);
}

async function postOnce(creds: ShellyCredentials, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`https://${creds.host}${path}?auth_key=${encodeURIComponent(creds.authKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new ShellyError(res.status);
  return res.json().catch(() => null);
}

export async function getDeviceStates(creds: ShellyCredentials, deviceIds: string[]): Promise<ShellyDeviceState[]> {
  const ids = [...new Set(deviceIds)];
  const states: ShellyDeviceState[] = [];
  for (let i = 0; i < ids.length; i += IDS_PER_CALL) {
    if (i > 0) await pause();
    const reply = await post(creds, "/v2/devices/api/get", { ids: ids.slice(i, i + IDS_PER_CALL), select: ["status"] });
    if (Array.isArray(reply)) states.push(...(reply as ShellyDeviceState[]));
  }
  return states;
}

export async function setDevice(
  creds: ShellyCredentials,
  device: { deviceId: string; channel: number; kind: LightKind },
  change: LightChange,
): Promise<void> {
  const { path, body } = shellyCommand(device, change);
  await post(creds, path, body);
}
