import "server-only";
import { and, asc, eq, isNull, lt, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import * as t from "@/db/schema";
import {
  mapHueLights,
  readShellyChannel,
  refreshOnce,
  tokenExpiresWithin,
  type ConnectionStatus,
  type Light,
  type LightChange,
  type LightProvider,
  type LightsOverview,
} from "@/lib/lights";
import { decrypt, encrypt, stableId } from "../bank/crypto";
import { hueEnv, lightsKey } from "../env";
import { scope, type HouseholdContext } from "../household";
import { listMembers, sendPushToMembers } from "../push";
import { createApplicationKey, exchangeCode, HueError, listResources, refreshTokens, setHueLight, type HueAccess, type HueTokens } from "./hue";
import { getDeviceStates, setDevice, ShellyError, type ShellyCredentials } from "./shelly";

/* The household's link to its lights: encrypted credentials, Hue token refresh, reading and setting lights. */

type Connection = typeof t.lightConnections.$inferSelect;
type HueCredentials = { accessToken: string; refreshToken: string; applicationKey: string };

/** A live call just before expiry can still fail halfway, so refresh a little ahead. */
const LIVE_MARGIN_MS = 5 * 60 * 1000;
/** The cron runs daily: it must not leave a token that ends before the next run. */
const CRON_MARGIN_MS = 48 * 60 * 60 * 1000;
const LEASE_MS = 30 * 1000;
const STATE_TTL_MS = 15 * 60 * 1000;

function key(): string {
  const value = lightsKey();
  if (!value) throw new Error("LIGHTS_TOKEN_KEY is not set");
  return value;
}

const seal = (credentials: ShellyCredentials | HueCredentials) => encrypt(JSON.stringify(credentials), key());
const open = <T>(row: Connection) => JSON.parse(decrypt(row.credentialsEnc, key())) as T;

const whereConnection = (ctx: HouseholdContext, provider: LightProvider) =>
  scope(ctx).where(t.lightConnections, eq(t.lightConnections.provider, provider));

async function readConnection(ctx: HouseholdContext, provider: LightProvider): Promise<Connection | null> {
  const [row] = await db.select().from(t.lightConnections).where(whereConnection(ctx, provider));
  return row ?? null;
}

async function saveConnection(ctx: HouseholdContext, provider: LightProvider, credentialsEnc: string, accessExpiresAt: Date | null) {
  const fresh = { credentialsEnc, accessExpiresAt, status: "active" as const, refreshLeaseUntil: null, expiryWarnedAt: null };
  await db
    .insert(t.lightConnections)
    .values({ householdId: ctx.householdId, provider, ...fresh })
    .onConflictDoUpdate({
      target: [t.lightConnections.householdId, t.lightConnections.provider],
      set: { ...fresh, updatedAt: new Date() },
    });
}

async function markExpired(ctx: HouseholdContext, provider: LightProvider) {
  await db
    .update(t.lightConnections)
    .set({ status: "expired", refreshLeaseUntil: null, updatedAt: new Date() })
    .where(whereConnection(ctx, provider));
}

/** Removes the link, and for Shelly the devices added under it. The vendor's own data stays. */
export async function removeLightConnection(ctx: HouseholdContext, provider: LightProvider): Promise<void> {
  await db.delete(t.lightConnections).where(whereConnection(ctx, provider));
  if (provider === "shelly") await db.delete(t.lightDevices).where(scope(ctx).where(t.lightDevices));
}

/* ---------- Shelly ---------- */

export async function saveShellyConnection(ctx: HouseholdContext, credentials: ShellyCredentials): Promise<void> {
  await saveConnection(ctx, "shelly", seal(credentials), null);
}

/** Looks the device up at Shelly first; false when that channel is not there or the device is offline. */
export async function addShellyDevice(
  ctx: HouseholdContext,
  input: { deviceId: string; channel: number; name: string; room: string | null },
): Promise<boolean> {
  const connection = await readConnection(ctx, "shelly");
  if (!connection) return false;
  const [state] = await callShelly(ctx, (creds) => getDeviceStates(creds, [input.deviceId]), connection);
  const channel = readShellyChannel(state?.status, input.channel);
  if (!channel) return false;
  const row = { deviceId: input.deviceId, channel: input.channel, kind: channel.kind, name: input.name, room: input.room };
  await db
    .insert(t.lightDevices)
    .values({ householdId: ctx.householdId, id: stableId("ld", `${ctx.householdId}:${input.deviceId}:${input.channel}`), ...row })
    .onConflictDoUpdate({ target: [t.lightDevices.householdId, t.lightDevices.id], set: { ...row, updatedAt: new Date() } });
  return true;
}

export async function removeShellyDevice(ctx: HouseholdContext, id: string): Promise<void> {
  await db.delete(t.lightDevices).where(scope(ctx).where(t.lightDevices, eq(t.lightDevices.id, id)));
}

/** A key that stopped working (it changes with the account password) shows as "connect again". */
async function callShelly<T>(ctx: HouseholdContext, call: (creds: ShellyCredentials) => Promise<T>, connection: Connection): Promise<T> {
  try {
    return await call(open<ShellyCredentials>(connection));
  } catch (err) {
    if (err instanceof ShellyError && err.unauthorized) await markExpired(ctx, "shelly");
    throw err;
  }
}

async function listShelly(ctx: HouseholdContext, connection: Connection): Promise<{ lights: Light[]; reachable: boolean }> {
  const devices = await db.select().from(t.lightDevices).where(scope(ctx).where(t.lightDevices)).orderBy(asc(t.lightDevices.name));
  let reachable = true;
  const states =
    devices.length === 0
      ? []
      : await callShelly(ctx, (creds) => getDeviceStates(creds, devices.map((d) => d.deviceId)), connection).catch((err) => {
          console.error("shelly list failed", err instanceof ShellyError ? err.message : "unknown");
          reachable = false;
          return [];
        });
  const lights = devices.map((d): Light => {
    const state = states.find((s) => s.id === d.deviceId);
    const channel = readShellyChannel(state?.status, d.channel);
    return {
      id: `shelly:${d.id}`,
      provider: "shelly",
      name: d.name,
      room: d.room,
      kind: d.kind,
      on: channel?.on ?? false,
      brightness: channel?.brightness ?? null,
      online: !!state?.online && !!channel,
    };
  });
  return { lights, reachable };
}

/* ---------- Hue ---------- */

export async function createHueAuthState(ctx: HouseholdContext): Promise<string> {
  await db
    .delete(t.lightAuthStates)
    .where(scope(ctx).where(t.lightAuthStates, lt(t.lightAuthStates.createdAt, new Date(Date.now() - STATE_TTL_MS))));
  const [row] = await db.insert(t.lightAuthStates).values({ householdId: ctx.householdId }).returning({ state: t.lightAuthStates.state });
  return row.state;
}

/**
 * Unscoped by design, like the bank link: the redirect may arrive in Safari without the PWA's session.
 * The state is a server-made random uuid, single use and short-lived; the household comes from this row.
 */
export async function takeHueAuthStateUnscoped(state: string): Promise<string | null> {
  const [row] = await db.delete(t.lightAuthStates).where(eq(t.lightAuthStates.state, state)).returning();
  if (!row || Date.now() - row.createdAt.getTime() > STATE_TTL_MS) return null;
  return row.householdId;
}

/** Finishes the Hue consent; nothing is stored unless the bridge also gave its key. */
export async function connectHue(ctx: HouseholdContext, code: string): Promise<void> {
  const tokens = await exchangeCode(code);
  const applicationKey = await createApplicationKey(tokens.accessToken);
  await saveConnection(ctx, "hue", sealHue(tokens, applicationKey), tokens.accessExpiresAt);
}

const sealHue = (tokens: HueTokens, applicationKey: string) =>
  seal({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, applicationKey });

/** Rotates the tokens with one caller at a time. `isFresh` says when another caller's result is good enough. */
async function refreshHue(ctx: HouseholdContext, isFresh: (row: Connection) => boolean): Promise<Connection> {
  const where = whereConnection(ctx, "hue");
  return refreshOnce<Connection>({
    claim: async () => {
      const now = new Date();
      const free = or(isNull(t.lightConnections.refreshLeaseUntil), lt(t.lightConnections.refreshLeaseUntil, now));
      const [row] = await db
        .update(t.lightConnections)
        .set({ refreshLeaseUntil: new Date(now.getTime() + LEASE_MS) })
        .where(and(where, free))
        .returning();
      return row ?? null;
    },
    read: async () => {
      const [row] = await db.select().from(t.lightConnections).where(where);
      if (!row) throw new HueError(401);
      return row;
    },
    isFresh,
    rotate: async (row) => {
      const current = open<HueCredentials>(row);
      let tokens: HueTokens;
      try {
        tokens = await refreshTokens(current.refreshToken);
      } catch (err) {
        // Hue refuses the refresh token: only a new consent helps. Other failures may pass, so they keep the link.
        if (err instanceof HueError && (err.status === 400 || err.status === 401)) await markExpired(ctx, "hue");
        throw err;
      }
      const [saved] = await db
        .update(t.lightConnections)
        .set({
          credentialsEnc: sealHue(tokens, current.applicationKey),
          accessExpiresAt: tokens.accessExpiresAt,
          status: "active",
          refreshLeaseUntil: null,
          expiryWarnedAt: null,
          updatedAt: new Date(),
        })
        .where(where)
        .returning();
      return saved;
    },
    release: async () => {
      await db.update(t.lightConnections).set({ refreshLeaseUntil: null }).where(where);
    },
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  });
}

const accessOf = (row: Connection): HueAccess => {
  const { accessToken, applicationKey } = open<HueCredentials>(row);
  return { accessToken, applicationKey };
};

/** Runs a call with a valid token. A 401 despite the stored expiry gets one refresh and one retry. */
async function callHue<T>(ctx: HouseholdContext, connection: Connection, call: (access: HueAccess) => Promise<T>): Promise<T> {
  const valid = (row: Connection) => !tokenExpiresWithin(row.accessExpiresAt, new Date(), LIVE_MARGIN_MS);
  const row = valid(connection) ? connection : await refreshHue(ctx, valid);
  try {
    return await call(accessOf(row));
  } catch (err) {
    if (!(err instanceof HueError && err.status === 401)) throw err;
    const refreshed = await refreshHue(ctx, (r) => valid(r) && r.credentialsEnc !== row.credentialsEnc);
    return call(accessOf(refreshed));
  }
}

/* ---------- Reading and setting ---------- */

export async function lightsOverview(ctx: HouseholdContext): Promise<LightsOverview> {
  const rows = await db.select().from(t.lightConnections).where(scope(ctx).where(t.lightConnections));
  const shelly = rows.find((r) => r.provider === "shelly");
  const hue = rows.find((r) => r.provider === "hue");
  const lights: Light[] = [];
  const problems: LightProvider[] = [];
  const connections: Record<LightProvider, ConnectionStatus> = { shelly: shelly?.status ?? null, hue: hue?.status ?? null };

  await Promise.all([
    (async () => {
      if (hue?.status !== "active") return;
      try {
        const { lights: found, rooms } = await callHue(ctx, hue, listResources);
        lights.push(...mapHueLights(found, rooms));
      } catch (err) {
        console.error("hue list failed", err instanceof HueError ? err.message : err instanceof Error ? err.name : "unknown");
        problems.push("hue");
        // The refresh may just have ended the link: show that, not a passing failure.
        connections.hue = (await readConnection(ctx, "hue"))?.status ?? null;
      }
    })(),
    (async () => {
      if (shelly?.status !== "active") return;
      const result = await listShelly(ctx, shelly);
      lights.push(...result.lights);
      if (!result.reachable) {
        problems.push("shelly");
        connections.shelly = (await readConnection(ctx, "shelly"))?.status ?? null;
      }
    })(),
  ]);
  return { connections, hueAvailable: !!hueEnv(), lights, problems };
}

/** Applies a change to "<provider>:<id>". False when this household has no such light or link. */
export async function setLight(ctx: HouseholdContext, id: string, change: LightChange): Promise<boolean> {
  const split = id.indexOf(":");
  const provider = id.slice(0, split);
  const target = id.slice(split + 1);
  if (provider === "hue") {
    const connection = await readConnection(ctx, "hue");
    if (!connection) return false;
    await callHue(ctx, connection, (access) => setHueLight(access, target, change));
    return true;
  }
  if (provider === "shelly") {
    const [device] = await db.select().from(t.lightDevices).where(scope(ctx).where(t.lightDevices, eq(t.lightDevices.id, target)));
    const connection = await readConnection(ctx, "shelly");
    if (!device || !connection) return false;
    await callShelly(ctx, (creds) => setDevice(creds, device, change), connection);
    return true;
  }
  return false;
}

/* ---------- Cron ---------- */

/** Unscoped by design: the cron finds its work across households, then acts per household. */
export async function householdsWithHue(): Promise<string[]> {
  const rows = await db.select({ householdId: t.lightConnections.householdId }).from(t.lightConnections).where(eq(t.lightConnections.provider, "hue"));
  return rows.map((r) => r.householdId);
}

/** Keeps the tokens ahead of expiry, and asks once to connect again when that is no longer possible. */
export async function maintainHue(ctx: HouseholdContext): Promise<"refreshed" | "current" | "expired"> {
  const connection = await readConnection(ctx, "hue");
  if (!connection) return "current";
  const due = (row: Connection) => tokenExpiresWithin(row.accessExpiresAt, new Date(), CRON_MARGIN_MS);
  let result: "refreshed" | "current" = "current";
  if (connection.status === "active" && due(connection)) {
    try {
      await refreshHue(ctx, (row) => !due(row));
      result = "refreshed";
    } catch (err) {
      console.error("hue refresh failed", err instanceof HueError ? err.message : err instanceof Error ? err.name : "unknown");
    }
  }
  const latest = await readConnection(ctx, "hue");
  if (latest?.status !== "expired") return result;
  if (!latest.expiryWarnedAt) await warnReconnect(ctx);
  return "expired";
}

async function warnReconnect(ctx: HouseholdContext): Promise<void> {
  const tr = await getTranslations({ locale: "nl", namespace: "lights.push" });
  const members = await listMembers(ctx);
  try {
    await sendPushToMembers(ctx, members.map((m) => m.id), { title: tr("title"), body: tr("body"), url: "/huis/lampen", tag: "lights-hue" });
  } catch {
    console.error("lights reconnect push failed");
    return;
  }
  await db.update(t.lightConnections).set({ expiryWarnedAt: new Date() }).where(whereConnection(ctx, "hue"));
}
