"use server";

import { z } from "zod";
import { normalizeShellyHost, type LightsOverview } from "@/lib/lights";
import { hueEnv, lightsKey } from "@/lib/server/env";
import { requireHouseholdForAction } from "@/lib/server/household";
import { authorizeUrl, HueError } from "@/lib/server/lights/hue";
import { ShellyError } from "@/lib/server/lights/shelly";
import {
  addShellyDevice,
  createHueAuthState,
  editShellyDevice,
  lightsOverview,
  removeLightConnection,
  removeShellyDevice,
  saveShellyConnection,
  setLight,
} from "@/lib/server/lights/connections";

type Fail = { ok: false; error: "unauthorized" | "unavailable" | "invalid" | "notFound" | "taken" | "failed" };
type Done = { ok: true } | Fail;

/** Only our own vendor errors carry a message: they hold a status, never a URL with a key in it. */
const logFailure = (where: string, err: unknown) =>
  console.error(where, err instanceof ShellyError || err instanceof HueError ? err.message : err instanceof Error ? err.name : "unknown");

async function context(): Promise<{ ctx: NonNullable<Awaited<ReturnType<typeof requireHouseholdForAction>>> } | Fail> {
  const ctx = await requireHouseholdForAction();
  if (!ctx) return { ok: false, error: "unauthorized" };
  if (!lightsKey()) return { ok: false, error: "unavailable" };
  return { ctx };
}

/** Current state of every connected light. Keys and tokens never leave the server; the Shelly host does. */
export async function getLights(input?: unknown): Promise<({ ok: true } & LightsOverview) | Fail> {
  const c = await context();
  if ("error" in c) return c;
  const parsed = z.object({ provider: z.enum(["shelly", "hue"]).optional() }).safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    return { ok: true, ...(await lightsOverview(c.ctx, parsed.data.provider)) };
  } catch (err) {
    logFailure("getLights failed", err);
    return { ok: false, error: "failed" };
  }
}

const changeInput = z
  .object({
    id: z.string().regex(/^(hue|shelly):[A-Za-z0-9_-]{1,64}$/),
    on: z.boolean().optional(),
    brightness: z.number().int().min(1).max(100).optional(),
  })
  .refine((v) => v.on !== undefined || v.brightness !== undefined);

export async function changeLight(input: unknown): Promise<Done> {
  const c = await context();
  if ("error" in c) return c;
  const parsed = changeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { id, ...change } = parsed.data;
  try {
    return (await setLight(c.ctx, id, change)) ? { ok: true } : { ok: false, error: "notFound" };
  } catch (err) {
    logFailure("changeLight failed", err);
    return { ok: false, error: "failed" };
  }
}

const shellyInput = z.object({ host: z.string().max(200), authKey: z.string().trim().min(1).max(500) });

export async function connectShelly(input: unknown): Promise<Done> {
  const c = await context();
  if ("error" in c) return c;
  const parsed = shellyInput.safeParse(input);
  const host = parsed.success ? normalizeShellyHost(parsed.data.host) : null;
  if (!parsed.success || !host) return { ok: false, error: "invalid" };
  try {
    await saveShellyConnection(c.ctx, { host, authKey: parsed.data.authKey });
    return { ok: true };
  } catch (err) {
    logFailure("connectShelly failed", err);
    return { ok: false, error: "failed" };
  }
}

const deviceInput = z.object({
  deviceId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/),
  channel: z.number().int().min(0).max(15),
  name: z.string().trim().min(1).max(60),
  room: z.string().trim().max(60).transform((v) => v || null),
});

export async function addShelly(input: unknown): Promise<Done> {
  const c = await context();
  if ("error" in c) return c;
  const parsed = deviceInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    return (await addShellyDevice(c.ctx, parsed.data)) ? { ok: true } : { ok: false, error: "notFound" };
  } catch (err) {
    logFailure("addShelly failed", err);
    return { ok: false, error: "failed" };
  }
}

export async function editShelly(input: unknown): Promise<Done> {
  const c = await context();
  if ("error" in c) return c;
  const parsed = deviceInput.extend({ id: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { id, ...device } = parsed.data;
  try {
    const result = await editShellyDevice(c.ctx, id, device);
    return result === "saved" ? { ok: true } : { ok: false, error: result };
  } catch (err) {
    logFailure("editShelly failed", err);
    return { ok: false, error: "failed" };
  }
}

export async function removeShelly(input: unknown): Promise<Done> {
  const c = await context();
  if ("error" in c) return c;
  const parsed = z.object({ id: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  await removeShellyDevice(c.ctx, parsed.data.id);
  return { ok: true };
}

/** Starts the Hue consent; the client sends the user to the returned URL. */
export async function startHueLink(): Promise<{ ok: true; url: string } | Fail> {
  const c = await context();
  if ("error" in c) return c;
  const env = hueEnv();
  if (!env) return { ok: false, error: "unavailable" };
  try {
    return { ok: true, url: authorizeUrl(env.HUE_CLIENT_ID, await createHueAuthState(c.ctx)) };
  } catch (err) {
    logFailure("startHueLink failed", err);
    return { ok: false, error: "failed" };
  }
}

export async function disconnectLights(input: unknown): Promise<Done> {
  const c = await context();
  if ("error" in c) return c;
  const parsed = z.object({ provider: z.enum(["shelly", "hue"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  await removeLightConnection(c.ctx, parsed.data.provider);
  return { ok: true };
}
