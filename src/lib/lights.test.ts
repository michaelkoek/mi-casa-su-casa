import { describe, expect, it, vi } from "vitest";
import {
  groupByRoom,
  hueLightBody,
  mapHueLights,
  normalizeShellyHost,
  parseHueTokens,
  parseHueUsername,
  readShellyChannel,
  retryWhileLimited,
  refreshOnce,
  shellyCommand,
  tokenExpiresWithin,
  type Light,
} from "./lights";

describe("normalizeShellyHost", () => {
  it("accepts the account's cloud host, also pasted as a URL", () => {
    expect(normalizeShellyHost("shelly-42-eu.shelly.cloud")).toBe("shelly-42-eu.shelly.cloud");
    expect(normalizeShellyHost(" https://Shelly-42-EU.shelly.cloud/ ")).toBe("shelly-42-eu.shelly.cloud");
  });
  it("refuses anything that could send the key elsewhere", () => {
    for (const bad of [
      "evil.com",
      "shelly.cloud.evil.com",
      "evil.com/.shelly.cloud",
      "evil.com#.shelly.cloud",
      "user@a.shelly.cloud",
      "a.shelly.cloud:8080",
      "http://a.shelly.cloud",
      "shelly.cloud",
      "",
    ])
      expect(normalizeShellyHost(bad)).toBeNull();
  });
});

describe("readShellyChannel", () => {
  it("reads a relay", () => {
    expect(readShellyChannel({ "switch:0": { output: true } }, 0)).toEqual({ kind: "switch", on: true, brightness: null });
  });
  it("reads a dimmer on its own channel", () => {
    const status = { "light:0": { output: false, brightness: 10 }, "light:1": { output: true, brightness: 55 } };
    expect(readShellyChannel(status, 1)).toEqual({ kind: "light", on: true, brightness: 55 });
  });
  it("reads colour lights as lights", () => {
    expect(readShellyChannel({ "rgbw:0": { output: true, brightness: 30 } }, 0)?.kind).toBe("light");
  });
  it("returns null for a missing channel or status", () => {
    expect(readShellyChannel({ "switch:0": { output: true } }, 1)).toBeNull();
    expect(readShellyChannel({ sys: {} }, 0)).toBeNull();
    expect(readShellyChannel(undefined, 0)).toBeNull();
  });
});

describe("retryWhileLimited", () => {
  const limited = new Error("429");
  const isLimited = (err: unknown) => err === limited;
  const noWait = () => Promise.resolve();

  it("gets the result after the limit has passed", async () => {
    let calls = 0;
    const call = async () => {
      if (++calls < 3) throw limited;
      return "ok";
    };
    await expect(retryWhileLimited(call, isLimited, noWait)).resolves.toBe("ok");
    expect(calls).toBe(3);
  });
  it("gives up after the retries", async () => {
    let calls = 0;
    const call = async () => {
      calls++;
      throw limited;
    };
    await expect(retryWhileLimited(call, isLimited, noWait)).rejects.toBe(limited);
    expect(calls).toBe(3);
  });
  it("does not repeat other failures", async () => {
    let calls = 0;
    const other = new Error("401");
    const call = async () => {
      calls++;
      throw other;
    };
    await expect(retryWhileLimited(call, isLimited, noWait)).rejects.toBe(other);
    expect(calls).toBe(1);
  });
});

describe("shellyCommand", () => {
  it("uses the switch endpoint for a relay and sends only on/off", () => {
    expect(shellyCommand({ deviceId: "a1", channel: 1, kind: "switch" }, { on: true, brightness: 40 })).toEqual({
      path: "/v2/devices/api/set/switch",
      body: { id: "a1", channel: 1, on: true },
    });
  });
  it("uses the light endpoint and sends only what changed", () => {
    expect(shellyCommand({ deviceId: "a1", channel: 0, kind: "light" }, { brightness: 40 })).toEqual({
      path: "/v2/devices/api/set/light",
      body: { id: "a1", channel: 0, brightness: 40 },
    });
    expect(shellyCommand({ deviceId: "a1", channel: 0, kind: "light" }, { on: false }).body).toEqual({ id: "a1", channel: 0, on: false });
  });
});

describe("mapHueLights", () => {
  const rooms = [{ metadata: { name: "Keuken" }, children: [{ rid: "device-1" }, { rid: "light-3" }] }];
  it("finds the room through the owning device or the light itself", () => {
    const lights = mapHueLights(
      [
        { id: "light-1", owner: { rid: "device-1" }, metadata: { name: "Spot" }, on: { on: true }, dimming: { brightness: 49.6 } },
        { id: "light-2", owner: { rid: "device-9" }, metadata: { name: "Gang" }, on: { on: false } },
        { id: "light-3", metadata: { name: "Tafel" } },
      ],
      rooms,
    );
    expect(lights[0]).toMatchObject({ id: "hue:light-1", room: "Keuken", on: true, brightness: 50 });
    expect(lights[1]).toMatchObject({ room: null, on: false, brightness: null });
    expect(lights[2].room).toBe("Keuken");
  });
});

describe("hueLightBody", () => {
  it("sends only what changed", () => {
    expect(hueLightBody({ on: true })).toEqual({ on: { on: true } });
    expect(hueLightBody({ brightness: 20 })).toEqual({ dimming: { brightness: 20 } });
  });
});

describe("parseHueTokens", () => {
  const now = new Date("2026-11-02T10:00:00Z");
  it("computes the expiry from expires_in, as number or string", () => {
    expect(parseHueTokens({ access_token: "a", refresh_token: "r", expires_in: "60" }, now)?.accessExpiresAt).toEqual(new Date("2026-11-02T10:01:00Z"));
  });
  it("falls back to seven days without expires_in", () => {
    expect(parseHueTokens({ access_token: "a", refresh_token: "r" }, now)?.accessExpiresAt).toEqual(new Date("2026-11-09T10:00:00Z"));
  });
  it("refuses a reply without both tokens", () => {
    expect(parseHueTokens({ access_token: "a" }, now)).toBeNull();
    expect(parseHueTokens({ error: "invalid_grant" }, now)).toBeNull();
  });
});

describe("parseHueUsername", () => {
  it("reads the key and refuses an error reply", () => {
    expect(parseHueUsername([{ success: { username: "key" } }])).toBe("key");
    expect(parseHueUsername([{ error: { type: 101, description: "link button not pressed" } }])).toBeNull();
    expect(parseHueUsername([])).toBeNull();
  });
});

describe("tokenExpiresWithin", () => {
  const now = new Date("2026-11-02T10:00:00Z");
  it("is true inside the margin and for an unknown expiry", () => {
    expect(tokenExpiresWithin(new Date("2026-11-02T10:04:00Z"), now, 5 * 60_000)).toBe(true);
    expect(tokenExpiresWithin(new Date("2026-11-02T10:06:00Z"), now, 5 * 60_000)).toBe(false);
    expect(tokenExpiresWithin(null, now, 1)).toBe(true);
  });
});

describe("refreshOnce", () => {
  /** A stored row with a lease, like the database row. */
  function fakeStore(generation = 0) {
    let row = { generation };
    let leased = false;
    const rotate = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      row = { generation: row.generation + 1 };
      leased = false;
      return row;
    });
    return {
      rotate,
      steps: {
        claim: async () => {
          if (leased) return null;
          leased = true;
          return row;
        },
        read: async () => row,
        isFresh: (r: { generation: number }) => r.generation > generation,
        rotate,
        release: async () => {
          leased = false;
        },
        wait: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
      },
      isLeased: () => leased,
    };
  }

  it("rotates only once when both phones refresh at the same time", async () => {
    const store = fakeStore();
    const [a, b] = await Promise.all([refreshOnce(store.steps, 10, 1), refreshOnce(store.steps, 10, 1)]);
    expect(store.rotate).toHaveBeenCalledTimes(1);
    expect(a.generation).toBe(1);
    expect(b.generation).toBe(1);
  });

  it("does not rotate when another caller already did, and frees the lease", async () => {
    const store = fakeStore();
    const result = await refreshOnce({ ...store.steps, isFresh: () => true });
    expect(store.rotate).not.toHaveBeenCalled();
    expect(result.generation).toBe(0);
    expect(store.isLeased()).toBe(false);
  });

  it("frees the lease when rotating fails, so the next try can run", async () => {
    const store = fakeStore();
    const failing = { ...store.steps, rotate: async () => Promise.reject(new Error("hue down")) };
    await expect(refreshOnce(failing)).rejects.toThrow("hue down");
    expect(store.isLeased()).toBe(false);
  });

  it("gives up when the lease stays taken", async () => {
    const store = fakeStore();
    await expect(refreshOnce({ ...store.steps, claim: async () => null }, 2, 1)).rejects.toThrow("busy");
  });
});

describe("groupByRoom", () => {
  const light = (name: string, room: string | null): Light => ({
    id: name,
    provider: "hue",
    name,
    room,
    kind: "light",
    on: false,
    brightness: null,
    online: true,
  });
  it("sorts rooms and names, with lights without a room last", () => {
    const groups = groupByRoom([light("B", "Woonkamer"), light("Z", null), light("C", "Keuken"), light("A", "Woonkamer")]);
    expect(groups.map((g) => g.room)).toEqual(["Keuken", "Woonkamer", null]);
    expect(groups[1].lights.map((l) => l.name)).toEqual(["A", "B"]);
  });
});
