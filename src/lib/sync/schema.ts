import { z } from "zod";
import { MAX_CENTS } from "../logic";
import { SIGNAL_ICONS } from "../types";
import { COLLECTIONS, type Change, type Changeset, type CollectionName, type RowMap } from "./collections";

/* Zod schemas for rows and changesets. Shared by the server action and the tests. Pure. */

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const text = z.string().trim().min(1).max(200);
const optText = z.string().max(200);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  });
const iso = z.iso.datetime();
const position = z.number().int().min(0).max(100000);
const cents = z.number().int().min(0).max(MAX_CENTS);
const slot = z.union([id, z.null()]);

const priority = z.enum(["high", "medium", "low"]);
const kind = z.enum(["finish", "maintenance"]);
const status = z.enum(["todo", "doing", "done"]);
const signalIcon = z.enum(SIGNAL_ICONS);

export const rowSchemas: { [C in CollectionName]: z.ZodType<RowMap[C]> } = {
  members: z.strictObject({ id, name: text, position }),
  signals: z.strictObject({ id, label: text, icon: signalIcon, openedBy: slot, openedAt: z.union([iso, z.null()]), position }),
  chores: z.strictObject({
    id, title: text, intervalDays: z.number().int().min(1).max(365),
    rotation: z.array(id).min(1).max(10), nextDue: date, position,
  }),
  tasks: z.strictObject({
    id, title: text, assigneeId: id, due: z.union([date, z.null()]),
    dueLabel: z.union([optText, z.null()]), doneAt: z.union([iso, z.null()]), position,
  }),
  projects: z.strictObject({ id, title: text, room: text, kind, priority, status, costCents: cents, position }),
  materials: z.strictObject({ id, projectId: id, name: text, bought: z.boolean(), position }),
  categories: z.strictObject({ id, name: text, budgetCents: z.union([cents, z.null()]), position }),
  transactions: z.strictObject({
    id, date, counterparty: text, amountCents: z.number().int().min(-1_000_000_000).max(1_000_000_000),
    categoryId: z.union([id, z.null()]), source: z.enum(["bank", "manual"]),
    accountId: z.union([id, z.null()]), description: z.union([optText, z.null()]), transfer: z.boolean(),
  }),
  rules: z.strictObject({ id, contains: text, categoryId: id, position }),
  care: z.strictObject({ weekday: z.literal([1, 2, 3, 4, 5]), atHome: z.boolean(), bring: slot, pick: slot }),
  medicines: z.strictObject({ id, name: text, intervalHours: z.number().int().min(1).max(72), position }),
  doses: z.strictObject({ id, medicineId: id, amount: optText, at: iso, by: id, position }),
  temperatures: z.strictObject({ id, celsius: z.number().min(30).max(45), at: iso, position }),
  appointments: z.strictObject({ id, title: text, at: iso, place: z.union([optText, z.null()]), position }),
  routine: z.strictObject({ id, time: z.string().regex(/^\d{2}:\d{2}$/), label: text, position }),
  milestones: z.strictObject({ id, date, text: z.string().trim().min(1).max(500), position }),
  sizes: z.strictObject({ id, label: text, size: text, note: z.union([optText, z.null()]), position }),
  stock: z.strictObject({ id, name: text, level: z.enum(["full", "half", "low"]), position }),
  growth: z.strictObject({
    id, date, weightGrams: z.number().int().min(0).max(200000), lengthCm: z.number().min(0).max(250), position,
  }),
  foods: z.strictObject({ id, name: text, date, verdict: z.enum(["likes", "dislikes", "unsure"]), position }),
  recipes: z.strictObject({ id, name: text, ingredients: z.array(z.string().min(1).max(100)).max(50), position }),
  mealPlan: z.strictObject({ date, title: z.string().trim().min(1).max(100), recipeId: z.union([id, z.null()]), cookId: id }),
  shopping: z.strictObject({
    id, name: text, checked: z.boolean(), source: z.enum(["manual", "recipe", "project", "stock"]), position,
  }),
  events: z.strictObject({ id, title: text, start: iso, allDay: z.boolean(), position }),
};

const keySchemas: Partial<Record<CollectionName, z.ZodType<string>>> = {
  care: z.string().regex(/^[1-5]$/),
  mealPlan: date,
};

const keyFor = (c: CollectionName) => keySchemas[c] ?? id;

/** Patch schemas: only updatable fields, each optional, no unknown fields. */
const patchSchemas = Object.fromEntries(
  (Object.keys(COLLECTIONS) as CollectionName[]).map((c) => {
    const shape = (rowSchemas[c] as unknown as z.ZodObject).shape as Record<string, z.ZodType>;
    const allowed = COLLECTIONS[c].updatable ?? Object.keys(shape).filter((f) => f !== COLLECTIONS[c].key);
    return [c, z.strictObject(Object.fromEntries(allowed.map((f) => [f, shape[f].optional()])))];
  }),
) as unknown as Record<CollectionName, z.ZodType<Record<string, unknown>>>;

const MAX_CHANGES = 500;

type Parsed = { ok: true; value: Changeset } | { ok: false; reason: string };

/** Validates untrusted input into a Changeset. Never trusts a household id: strict schemas reject it. */
export function parseChangeset(input: unknown): Parsed {
  const head = z.object({ id: z.uuid(), changes: z.array(z.unknown()).min(1).max(MAX_CHANGES) }).safeParse(input);
  if (!head.success) return { ok: false, reason: "shape" };
  const changes: Change[] = [];
  for (const raw of head.data.changes) {
    const base = z
      .object({ op: z.enum(["insert", "update", "delete"]), c: z.string() })
      .loose()
      .safeParse(raw);
    if (!base.success) return { ok: false, reason: "change" };
    const { op, c } = base.data;
    if (!Object.hasOwn(COLLECTIONS, c)) return { ok: false, reason: "collection" };
    const name = c as CollectionName;
    if (!COLLECTIONS[name].ops.includes(op)) return { ok: false, reason: "op" };
    if (op === "insert") {
      const r = z.strictObject({ op: z.literal("insert"), c: z.string(), row: rowSchemas[name] }).safeParse(raw);
      if (!r.success) return { ok: false, reason: "row" };
      changes.push({ op, c: name, row: r.data.row } as Change);
    } else if (op === "update") {
      const r = z
        .strictObject({ op: z.literal("update"), c: z.string(), key: keyFor(name), patch: patchSchemas[name] })
        .safeParse(raw);
      if (!r.success) return { ok: false, reason: "patch" };
      const patch = Object.fromEntries(Object.entries(r.data.patch).filter(([, v]) => v !== undefined));
      if (Object.keys(patch).length === 0) return { ok: false, reason: "empty" };
      changes.push({ op, c: name, key: r.data.key, patch } as Change);
    } else {
      const r = z.strictObject({ op: z.literal("delete"), c: z.string(), key: keyFor(name) }).safeParse(raw);
      if (!r.success) return { ok: false, reason: "key" };
      changes.push({ op, c: name, key: r.data.key });
    }
  }
  return { ok: true, value: { id: head.data.id, changes } };
}

/** Member references that are not foreign keys: chore rotations and care slots. Returns problems found. */
export function memberRefIssues(changes: Change[], memberIds: Set<string>): string[] {
  const issues: string[] = [];
  const slotOk = (v: unknown) => v === null || v === "grandma" || (typeof v === "string" && memberIds.has(v));
  const rotationOk = (v: unknown) => Array.isArray(v) && v.every((m) => typeof m === "string" && memberIds.has(m));
  for (const ch of changes) {
    const data = (ch.op === "insert" ? ch.row : ch.op === "update" ? ch.patch : {}) as Record<string, unknown>;
    if (ch.c === "chores" && "rotation" in data && !rotationOk(data.rotation)) issues.push("chores.rotation");
    if (ch.c === "care") {
      if ("bring" in data && !slotOk(data.bring)) issues.push("care.bring");
      if ("pick" in data && !slotOk(data.pick)) issues.push("care.pick");
    }
  }
  return issues;
}
