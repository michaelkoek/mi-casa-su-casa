import { randomBytes } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../push", () => ({ listMembers: vi.fn(), sendPushToMembers: vi.fn() }));
vi.mock("@/db/schema", async () => await import("../../../db/schema"));
vi.mock("@/lib/lights", async () => await import("../../lights"));

/** Every WHERE clause the code builds, with the rows the next selects should return. */
const { wheres, selectResults } = vi.hoisted(() => ({ wheres: [] as unknown[], selectResults: [] as unknown[][] }));

vi.mock("@/db", () => {
  const chain = () => {
    const self: Record<string, unknown> = {
      from: () => self,
      orderBy: () => self,
      set: () => self,
      returning: () => self,
      where: (w: unknown) => {
        wheres.push(w);
        return self;
      },
      then: (resolve: (rows: unknown[]) => unknown) => resolve(selectResults.shift() ?? []),
    };
    return self;
  };
  return { db: { select: chain, update: chain, delete: chain, insert: chain } };
});

process.env.LIGHTS_TOKEN_KEY = randomBytes(32).toString("base64");

const { encrypt } = await import("../bank/crypto");
const { lightsOverview, removeLightConnection, removeShellyDevice, setLight } = await import("./connections");

const dialect = new PgDialect();
const ctx = { userId: "u", email: "a@x.nl", householdId: "hh-1", memberId: "m1" };
const scopedToHousehold = () =>
  wheres.map((w) => dialect.sqlToQuery(w as SQL).params).every((params) => params.includes("hh-1"));

const shellyRow = (credentials: object) => ({
  householdId: "hh-1",
  provider: "shelly",
  status: "active",
  credentialsEnc: encrypt(JSON.stringify(credentials), process.env.LIGHTS_TOKEN_KEY!),
  accessExpiresAt: null,
});

describe("lights stay inside the household", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    wheres.length = 0;
    selectResults.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("does not call Shelly for a device this household does not have", async () => {
    selectResults.push([], [shellyRow({ host: "a.shelly.cloud", authKey: "k" })]);
    expect(await setLight(ctx, "shelly:other-households-device", { on: true })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(wheres.length).toBeGreaterThan(0);
    expect(scopedToHousehold()).toBe(true);
  });

  it("does not call Hue without a connection in this household", async () => {
    selectResults.push([]);
    expect(await setLight(ctx, "hue:some-light", { on: true })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(scopedToHousehold()).toBe(true);
  });

  it("refuses an id without a known provider", async () => {
    expect(await setLight(ctx, "nest:abc", { on: true })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scopes every delete", async () => {
    await removeLightConnection(ctx, "shelly");
    await removeShellyDevice(ctx, "d1");
    expect(wheres).toHaveLength(3);
    expect(scopedToHousehold()).toBe(true);
  });

  it("never puts credentials in the overview", async () => {
    selectResults.push([shellyRow({ host: "a.shelly.cloud", authKey: "super-secret-key" })], []);
    const overview = await lightsOverview(ctx);
    expect(overview.connections.shelly).toBe("active");
    expect(JSON.stringify(overview)).not.toContain("super-secret-key");
    expect(JSON.stringify(overview)).not.toContain("a.shelly.cloud");
    expect(scopedToHousehold()).toBe(true);
  });

  it("sends the Shelly key only to the stored host and reports a light it can read", async () => {
    selectResults.push(
      [shellyRow({ host: "a.shelly.cloud", authKey: "k&y" })],
      [{ id: "d1", deviceId: "abc", channel: 0, kind: "light", name: "Hal", room: null }],
    );
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ id: "abc", online: 1, status: { "light:0": { output: true, brightness: 40 } } }])));
    const overview = await lightsOverview(ctx);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://a.shelly.cloud/v2/devices/api/get?auth_key=k%26y");
    expect(overview.lights[0]).toMatchObject({ id: "shelly:d1", on: true, brightness: 40, online: true });
  });

  it("shows devices as offline and names the provider when Shelly does not answer", async () => {
    selectResults.push(
      [shellyRow({ host: "a.shelly.cloud", authKey: "k" })],
      [{ id: "d1", deviceId: "abc", channel: 0, kind: "switch", name: "Hal", room: null }],
      [shellyRow({ host: "a.shelly.cloud", authKey: "k" })],
    );
    fetchMock.mockResolvedValue(new Response("", { status: 429 }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const overview = await lightsOverview(ctx);
    expect(overview.problems).toEqual(["shelly"]);
    expect(overview.lights[0]).toMatchObject({ online: false, on: false });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("auth_key");
    spy.mockRestore();
  });
});
