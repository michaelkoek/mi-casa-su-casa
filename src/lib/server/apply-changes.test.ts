import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/schema", async () => await import("../../db/schema"));
vi.mock("@/lib/sync/collections", async () => await import("../sync/collections"));
vi.mock("@/lib/sync/diff", async () => await import("../sync/diff"));
vi.mock("@/lib/sync/rows", async () => await import("../sync/rows"));
vi.mock("@/lib/logic", async () => await import("../logic"));
vi.mock("@/lib/sync/schema", async () => await import("../sync/schema"));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  batch: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@/db", () => ({
  db: { select: mocks.select, batch: mocks.batch, update: mocks.update, insert: mocks.insert, delete: mocks.del },
}));

import { PgDialect } from "drizzle-orm/pg-core";
import type { Change } from "@/lib/sync/collections";
import { writeChangeset } from "./apply-changes";

const ctx = { userId: "u", email: "a@x.nl", householdId: "hh-1", memberId: "m1" };
const cs = (...changes: Change[]) => ({ id: crypto.randomUUID(), changes });
const upd = (key: string, patch: object) => ({ op: "update", c: "transactions", key, patch }) as unknown as Change;
const row = (id: string, source: string) =>
  ({
    op: "insert", c: "transactions",
    row: { id, date: "2026-10-01", counterparty: "X", amountCents: -100, categoryId: null, source, accountId: null, description: null, transfer: false },
  }) as unknown as Change;

const members = () => ({ from: () => ({ where: () => Promise.resolve([{ id: "m1" }]) }) });
const txRows = (rows: object[], spy?: (w: unknown) => void) => ({
  from: () => ({ where: (w: unknown) => (spy?.(w), Promise.resolve(rows)) }),
});
const del = (c: string, key: string) => ({ op: "delete", c, key }) as unknown as Change;
const stored = (rows: object[], spy?: (w: unknown) => void) =>
  mocks.select.mockReturnValueOnce(members()).mockReturnValueOnce(txRows(rows, spy));
/** Records the where() condition of every update().set() and delete() call. */
const setWheres: unknown[] = [];
const delWheres: unknown[] = [];
const compile = (w: unknown) => new PgDialect().sqlToQuery(w as never);

beforeEach(() => {
  mocks.select.mockReset();
  mocks.update.mockReset();
  mocks.insert.mockReset();
  mocks.del.mockReset();
  mocks.batch.mockReset();
  setWheres.length = 0;
  delWheres.length = 0;
  mocks.update.mockReturnValue({ set: () => ({ where: (w: unknown) => (setWheres.push(w), "update-token") }) });
  mocks.insert.mockReturnValue({ values: () => ({ onConflictDoUpdate: () => "insert-token" }) });
  mocks.del.mockReturnValue({ where: (w: unknown) => (delWheres.push(w), "delete-token") });
  mocks.batch.mockResolvedValue([]);
});

describe("writeChangeset bank-row guard", () => {
  it("rejects amount patches, deletes, overwrites and bank inserts", async () => {
    const bad = [
      upd("x01", { amountCents: 1 }),
      { op: "delete", c: "transactions", key: "x01" } as Change,
      row("x01", "manual"),
      row("x99", "bank"),
    ];
    for (const change of bad) {
      mocks.select.mockReset();
      stored([{ id: "x01", source: "bank" }]);
      expect(await writeChangeset(ctx, cs(change))).toEqual({ ok: false, error: "invalid" });
    }
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it("accepts a category-only patch on a bank row", async () => {
    stored([{ id: "x01", source: "bank" }]);
    expect(await writeChangeset(ctx, cs(upd("x01", { categoryId: "home" })))).toEqual({ ok: true });
    expect(mocks.batch).toHaveBeenCalledTimes(1);
    const q = compile(setWheres[0]);
    expect(q.params).toContain("hh-1");
    expect(q.sql).not.toMatch(/<>|!=/); // category-only patches are the one thing allowed on bank rows
  });

  it("backstops locked-field updates, deletes and insert overwrites with source <> 'bank'", async () => {
    let conflict: { setWhere?: unknown } | undefined;
    mocks.insert.mockReturnValue({ values: () => ({ onConflictDoUpdate: (cfg: { setWhere?: unknown }) => ((conflict = cfg), "i") }) });
    stored([{ id: "xm1", source: "manual" }]);
    const r = await writeChangeset(ctx, cs(upd("xm1", { amountCents: -5 }), del("transactions", "xm1"), row("xm1", "manual")));
    expect(r).toEqual({ ok: true });
    for (const w of [setWheres[0], delWheres[0], conflict?.setWhere]) {
      expect(w).toBeDefined();
      expect(compile(w).sql).toMatch(/<>|!=/);
    }
    expect(compile(setWheres[0]).params).toContain("hh-1");
    expect(compile(delWheres[0]).params).toContain("hh-1");
  });
});

describe("writeChangeset bank-row guard (more)", () => {
  it.each(["amountCents", "date", "description"])("rejects a %s patch on a bank row", async (f) => {
    stored([{ id: "x01", source: "bank" }]);
    expect(await writeChangeset(ctx, cs(upd("x01", { [f]: f === "amountCents" ? 5 : "z" })))).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it("rejects a bank row mixed into an otherwise valid changeset, without writing anything", async () => {
    stored([{ id: "x01", source: "bank" }]);
    const r = await writeChangeset(ctx, cs(upd("xm1", { amountCents: 5 }), upd("x01", { amountCents: 5 })));
    expect(r).toEqual({ ok: false, error: "invalid" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it("looks up stored sources scoped to the caller's household", async () => {
    let where: unknown;
    stored([], (w) => (where = w));
    await writeChangeset(ctx, cs(upd("x01", { categoryId: "home" })));
    const q = compile(where);
    expect(q.params).toContain("hh-1");
    expect(q.params).toContain("x01");
  });

  it("another household's bank row is not in the scoped lookup, so only SQL scope protects it", async () => {
    // Lookup returns nothing (row belongs to hh-2): guard passes, but writes stay household-scoped.
    stored([]);
    expect(await writeChangeset(ctx, cs(upd("other", { amountCents: 5 })))).toEqual({ ok: true });
    const q = compile(setWheres[0]);
    expect(q.params).toContain("hh-1");
    expect(q.sql).toMatch(/<>|!=/); // source <> 'bank' defense in depth
  });

  it("allows full edit, delete and insert of manual rows", async () => {
    stored([{ id: "xm1", source: "manual" }]);
    const r = await writeChangeset(
      ctx,
      cs(upd("xm1", { amountCents: -5, date: "2026-10-02", description: "d" }), del("transactions", "xm1"), row("xm1", "manual")),
    );
    expect(r).toEqual({ ok: true });
    expect(mocks.batch).toHaveBeenCalledTimes(1);
    expect(compile(delWheres[0]).params).toContain("hh-1");
  });

  it("allows category, counterparty and transfer patches on a bank row", async () => {
    stored([{ id: "x01", source: "bank" }]);
    const r = await writeChangeset(ctx, cs(upd("x01", { categoryId: "home", counterparty: "N", transfer: true })));
    expect(r).toEqual({ ok: true });
  });

  it("category delete cascades household-scoped: null transactions, drop rules, delete category (in that order)", async () => {
    mocks.select.mockReturnValueOnce(members());
    const order: string[] = [];
    mocks.update.mockReturnValue({ set: () => ({ where: (w: unknown) => (order.push("nullTx"), setWheres.push(w), "u") }) });
    mocks.del.mockReturnValue({ where: (w: unknown) => (order.push("del"), delWheres.push(w), "d") });
    const r = await writeChangeset(ctx, cs(del("categories", "food")));
    expect(r).toEqual({ ok: true });
    expect(order).toEqual(["nullTx", "del", "del"]);
    expect(mocks.batch.mock.calls[0][0]).toEqual(["u", "d", "d"]);
    for (const w of [...setWheres, ...delWheres]) {
      const q = compile(w);
      expect(q.params).toContain("hh-1");
      expect(q.params).toContain("food");
    }
    expect(setWheres).toHaveLength(1);
    expect(delWheres).toHaveLength(2);
  });

  it("maps a foreign-key violation to conflict", async () => {
    mocks.select.mockReturnValueOnce(members());
    mocks.batch.mockRejectedValue({ code: "23503" });
    expect(await writeChangeset(ctx, cs(del("categories", "food")))).toEqual({ ok: false, error: "conflict" });
  });
});
