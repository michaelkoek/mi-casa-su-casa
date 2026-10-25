import { describe, expect, it, vi } from "vitest";
import { PgDialect, PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { eq, is } from "drizzle-orm";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", async () => await import("../../db/schema"));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import * as schema from "../../db/schema";
import { scope } from "./household";

const dialect = new PgDialect();
const ctx = { userId: "u", email: "a@x.nl", householdId: "hh-1", memberId: "m1" };

describe("scope()", () => {
  it("always filters on the household of the context", () => {
    const q = dialect.sqlToQuery(scope(ctx).where(schema.tasks));
    expect(q.sql).toContain("household_id");
    expect(q.params).toEqual(["hh-1"]);
  });

  it("ANDs extra conditions and keeps the household filter", () => {
    const q = dialect.sqlToQuery(scope(ctx).where(schema.tasks, eq(schema.tasks.id, "t1")));
    expect(q.sql).toContain("household_id");
    expect(q.sql).toContain(" and ");
    expect(q.params).toEqual(["hh-1", "t1"]);
  });

  it("ignores undefined conditions without dropping the filter", () => {
    const q = dialect.sqlToQuery(scope(ctx).where(schema.tasks, undefined));
    expect(q.params).toEqual(["hh-1"]);
  });
});

describe("schema: multi-household from day one", () => {
  const tables = (Object.values(schema) as unknown[]).filter((v): v is PgTable => is(v, PgTable));

  // Identity/infra tables that exist before a household is known.
  const GLOBAL = new Set(["households", "user", "session", "account", "verification", "rate_limit"]);

  it("every table except households has a not-null household_id", () => {
    expect(tables.length).toBeGreaterThan(5);
    for (const t of tables) {
      const cfg = getTableConfig(t);
      if (GLOBAL.has(cfg.name)) continue;
      const col = cfg.columns.find((c) => c.name === "household_id");
      expect(col, cfg.name).toBeDefined();
      expect(col!.notNull, cfg.name).toBe(true);
    }
  });
});
