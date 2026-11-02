import { z } from "zod";

/* Pure logic for the lights: vendor payloads in and out, room grouping, Hue token refresh. */

export type LightProvider = "shelly" | "hue";
export type LightKind = "light" | "switch";

/** `id` is "<provider>:<vendor or device row id>". `brightness` is 1-100, null when not dimmable. */
export type Light = {
  id: string;
  provider: LightProvider;
  name: string;
  room: string | null;
  kind: LightKind;
  on: boolean;
  brightness: number | null;
  online: boolean;
};

export type LightChange = { on?: boolean; brightness?: number };
export type ConnectionStatus = "active" | "expired" | null;

/** A Shelly device as the household entered it. `id` is the row id; the auth key is never part of this. */
export type ShellyDevice = { id: string; deviceId: string; channel: number; name: string; room: string | null };

export type LightsOverview = {
  connections: Record<LightProvider, ConnectionStatus>;
  hueAvailable: boolean;
  lights: Light[];
  shellyHost: string | null;
  shellyDevices: ShellyDevice[];
  /** Providers that could not be reached just now. */
  problems: LightProvider[];
};

/* ---------- Shelly ---------- */

/**
 * The account's cloud host, or null when it is not a Shelly host. The auth key is sent to this
 * host and the value comes from the user, so nothing else may pass.
 */
export function normalizeShellyHost(input: string): string | null {
  const host = input.trim().toLowerCase().replace(/^https:\/\//, "").replace(/\/$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.shelly\.cloud$/.test(host) ? host : null;
}

/**
 * Runs a call again while it reports the rate limit. Shelly allows one call per second per account,
 * shared by both phones, and adding a device reads it twice in a row.
 */
export async function retryWhileLimited<T>(
  call: () => Promise<T>,
  isLimited: (err: unknown) => boolean,
  wait: () => Promise<void>,
  retries = 2,
): Promise<T> {
  for (let left = retries; ; left--) {
    try {
      return await call();
    } catch (err) {
      if (left === 0 || !isLimited(err)) throw err;
      await wait();
    }
  }
}

const LIGHT_COMPONENTS = ["light", "cct", "rgb", "rgbw", "rgbcct"];

type ShellyComponent = { output?: unknown; brightness?: unknown };

/** Reads one channel from a Gen2+ status ("switch:0", "light:0", ...); null when it has neither. */
export function readShellyChannel(
  status: Record<string, unknown> | undefined,
  channel: number,
): { kind: LightKind; on: boolean; brightness: number | null } | null {
  if (!status) return null;
  const sw = status[`switch:${channel}`] as ShellyComponent | undefined;
  if (sw) return { kind: "switch", on: sw.output === true, brightness: null };
  for (const name of LIGHT_COMPONENTS) {
    const c = status[`${name}:${channel}`] as ShellyComponent | undefined;
    if (c) return { kind: "light", on: c.output === true, brightness: typeof c.brightness === "number" ? c.brightness : null };
  }
  return null;
}

/** Path and body that apply a change to one channel. A relay has only on/off. */
export function shellyCommand(device: { deviceId: string; channel: number; kind: LightKind }, change: LightChange) {
  const base = { id: device.deviceId, channel: device.channel };
  if (device.kind === "switch") return { path: "/v2/devices/api/set/switch", body: { ...base, on: change.on === true } };
  return {
    path: "/v2/devices/api/set/light",
    body: {
      ...base,
      ...(change.on !== undefined && { on: change.on }),
      ...(change.brightness !== undefined && { brightness: change.brightness }),
    },
  };
}

/* ---------- Hue ---------- */

export type HueLight = {
  id: string;
  owner?: { rid: string };
  metadata?: { name?: string };
  on?: { on?: boolean };
  dimming?: { brightness?: number };
};
export type HueRoom = { metadata?: { name?: string }; children?: { rid: string }[] };

/** Rooms list their devices (or lights) as children, so a light is matched by id or by its owner. */
export function mapHueLights(lights: HueLight[], rooms: HueRoom[]): Light[] {
  const roomOf = new Map<string, string>();
  for (const room of rooms) {
    if (!room.metadata?.name) continue;
    for (const child of room.children ?? []) roomOf.set(child.rid, room.metadata.name);
  }
  return lights.map((l) => ({
    id: `hue:${l.id}`,
    provider: "hue",
    name: l.metadata?.name ?? "Hue",
    room: roomOf.get(l.id) ?? (l.owner ? roomOf.get(l.owner.rid) : undefined) ?? null,
    kind: "light",
    on: l.on?.on === true,
    brightness: typeof l.dimming?.brightness === "number" ? Math.round(l.dimming.brightness) : null,
    online: true,
  }));
}

export function hueLightBody(change: LightChange) {
  return {
    ...(change.on !== undefined && { on: { on: change.on } }),
    ...(change.brightness !== undefined && { dimming: { brightness: change.brightness } }),
  };
}

const DEFAULT_ACCESS_SECONDS = 7 * 24 * 60 * 60;

const hueTokens = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.coerce.number().positive().optional(),
});

/** The token response, or null when it is not one. */
export function parseHueTokens(json: unknown, now: Date) {
  const parsed = hueTokens.safeParse(json);
  if (!parsed.success) return null;
  const seconds = parsed.data.expires_in ?? DEFAULT_ACCESS_SECONDS;
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    accessExpiresAt: new Date(now.getTime() + seconds * 1000),
  };
}

/** The application key from a "create user" reply: [{ success: { username } }]. */
export function parseHueUsername(json: unknown): string | null {
  const parsed = z.array(z.object({ success: z.object({ username: z.string().min(1) }) })).safeParse(json);
  return parsed.success ? (parsed.data[0]?.success.username ?? null) : null;
}

export function tokenExpiresWithin(expiresAt: Date | null, now: Date, marginMs: number): boolean {
  return !expiresAt || expiresAt.getTime() - now.getTime() < marginMs;
}

export type RefreshSteps<T> = {
  /** Takes the lease; returns the current row, or null when someone else holds it. */
  claim: () => Promise<T | null>;
  read: () => Promise<T>;
  isFresh: (row: T) => boolean;
  /** Fetches new tokens and stores them, which also ends the lease. */
  rotate: (row: T) => Promise<T>;
  release: () => Promise<void>;
  wait: (ms: number) => Promise<void>;
};

/**
 * Refreshing invalidates the previous tokens, so two phones must not do it at once: the loser
 * would overwrite good tokens with a failed attempt. One caller rotates, the others wait for it.
 */
export async function refreshOnce<T>(steps: RefreshSteps<T>, attempts = 10, pauseMs = 500): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    const claimed = await steps.claim();
    if (claimed) {
      try {
        if (!steps.isFresh(claimed)) return await steps.rotate(claimed);
      } catch (err) {
        await steps.release();
        throw err;
      }
      await steps.release();
      return claimed;
    }
    await steps.wait(pauseMs);
    const row = await steps.read();
    if (steps.isFresh(row)) return row;
  }
  throw new Error("Token refresh is busy");
}

/* ---------- Screen ---------- */

/** Named rooms alphabetically, lights without a room last. */
export function groupByRoom(lights: Light[]): { room: string | null; lights: Light[] }[] {
  const rooms = new Map<string | null, Light[]>();
  for (const light of lights) rooms.set(light.room, [...(rooms.get(light.room) ?? []), light]);
  return [...rooms.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b, "nl")))
    .map(([room, list]) => ({ room, lights: [...list].sort((a, b) => a.name.localeCompare(b.name, "nl")) }));
}
