import "server-only";
import { hueLightBody, parseHueTokens, parseHueUsername, type HueLight, type HueRoom, type LightChange } from "@/lib/lights";
import { hueEnv } from "../env";

/*
 * Hue Remote API: OAuth2 against the account, CLIP v2 routed through the cloud to the bridge.
 * Paths were written without access to the login-only docs: see docs/lights.md before trusting them.
 */

const BASE = "https://api.meethue.com";

export type HueTokens = NonNullable<ReturnType<typeof parseHueTokens>>;
export type HueAccess = { accessToken: string; applicationKey: string };

export class HueError extends Error {
  constructor(readonly status: number) {
    super(`Hue API ${status}`);
  }
}

async function send(path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new HueError(res.status);
  return res.json().catch(() => null);
}

export function authorizeUrl(clientId: string, state: string): string {
  const params = new URLSearchParams({ client_id: clientId, response_type: "code", state });
  return `${BASE}/v2/oauth2/authorize?${params}`;
}

async function tokenRequest(form: Record<string, string>): Promise<HueTokens> {
  const env = hueEnv();
  if (!env) throw new HueError(0);
  const basic = Buffer.from(`${env.HUE_CLIENT_ID}:${env.HUE_CLIENT_SECRET}`).toString("base64");
  const reply = await send("/v2/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });
  const tokens = parseHueTokens(reply, new Date());
  if (!tokens) throw new HueError(0);
  return tokens;
}

export const exchangeCode = (code: string) => tokenRequest({ grant_type: "authorization_code", code });
export const refreshTokens = (refreshToken: string) => tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

/** Presses the link button remotely, then creates the key CLIP v2 needs for this bridge. */
export async function createApplicationKey(accessToken: string): Promise<string> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  await send("/route/api/0/config", { method: "PUT", headers, body: JSON.stringify({ linkbutton: true }) });
  const reply = await send("/route/api", { method: "POST", headers, body: JSON.stringify({ devicetype: "mi_casa_su_casa#server" }) });
  const key = parseHueUsername(reply);
  if (!key) throw new HueError(0);
  return key;
}

const clipHeaders = (access: HueAccess) => ({
  Authorization: `Bearer ${access.accessToken}`,
  "hue-application-key": access.applicationKey,
});

async function resources<T>(access: HueAccess, type: "light" | "room"): Promise<T[]> {
  const reply = (await send(`/route/clip/v2/resource/${type}`, { headers: clipHeaders(access) })) as { data?: T[] } | null;
  return reply?.data ?? [];
}

export async function listResources(access: HueAccess): Promise<{ lights: HueLight[]; rooms: HueRoom[] }> {
  const [lights, rooms] = await Promise.all([resources<HueLight>(access, "light"), resources<HueRoom>(access, "room")]);
  return { lights, rooms };
}

export async function setHueLight(access: HueAccess, lightId: string, change: LightChange): Promise<void> {
  await send(`/route/clip/v2/resource/light/${encodeURIComponent(lightId)}`, {
    method: "PUT",
    headers: { ...clipHeaders(access), "Content-Type": "application/json" },
    body: JSON.stringify(hueLightBody(change)),
  });
}
