/* Creates a household with its members and starting data.
 *   npm run db:bootstrap -- --name "Thuis" --member "Michael=a@x.nl" --member "Partner=b@x.nl" [--demo]
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";
import { parseArgs } from "node:util";
import * as schema from "../src/db/schema";
import { createSeed, createStarter } from "../src/lib/seed";
import { WRITE_ORDER, type CollectionName } from "../src/lib/sync/collections";
import { toRows } from "../src/lib/sync/rows";
import type { Member } from "../src/lib/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* use the real environment */
}

const TABLES: Record<CollectionName, (typeof schema)[keyof typeof schema]> = {
  members: schema.members,
  signals: schema.signals,
  chores: schema.chores,
  tasks: schema.tasks,
  projects: schema.projects,
  materials: schema.materials,
  categories: schema.categories,
  transactions: schema.transactions,
  rules: schema.categoryRules,
  care: schema.careDays,
  medicines: schema.medicines,
  doses: schema.doses,
  temperatures: schema.temperatures,
  appointments: schema.appointments,
  routine: schema.routineItems,
  milestones: schema.milestones,
  sizes: schema.clothingSizes,
  stock: schema.stockItems,
  growth: schema.growthEntries,
  foods: schema.foodTries,
  recipes: schema.recipes,
  mealPlan: schema.mealPlan,
  shopping: schema.shoppingItems,
  events: schema.calendarEvents,
};

const TIMESTAMPS: Record<string, string[]> = {
  signals: ["openedAt"], tasks: ["doneAt"], doses: ["at"], temperatures: ["at"], appointments: ["at"], events: ["start"],
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      member: { type: "string", multiple: true },
      demo: { type: "boolean", default: false },
    },
  });
  const name = values.name?.trim();
  if (!name) fail("Missing --name");
  const specs = values.member ?? [];
  if (specs.length < 1 || specs.length > 4) fail("Give 1 to 4 --member \"Name=email\" options");

  const people = specs.map((spec) => {
    const i = spec.lastIndexOf("=");
    const personName = spec.slice(0, i).trim();
    const email = spec.slice(i + 1).trim().toLowerCase();
    if (i < 1 || !personName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`Invalid --member: ${personName || spec}`);
    return { name: personName, email };
  });
  if (new Set(people.map((p) => p.email)).size !== people.length) fail("Duplicate email in --member options");
  if (values.demo && people.length < 2) fail("--demo needs at least 2 members");

  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL is not set");
  const db = drizzle(neon(url), { schema });

  const existing = await db
    .select({ email: schema.members.email })
    .from(schema.members)
    .where(inArray(schema.members.email, people.map((p) => p.email)));
  if (existing.length > 0) fail(`Already a member: ${existing.map((e) => e.email).join(", ")}`);

  const members: Member[] = people.map((p, i) => ({ id: `m${i + 1}`, name: p.name }));
  const now = new Date();
  let state;
  if (values.demo) {
    const seed = createSeed(now);
    state = { ...seed, members: [...seed.members.map((m, i) => ({ ...m, name: members[i].name })), ...members.slice(seed.members.length)] };
  } else {
    state = createStarter(members, now);
  }

  const [household] = await db.insert(schema.households).values({ name }).returning({ id: schema.households.id });
  const householdId = household.id;
  const rows = toRows(state) as unknown as Record<CollectionName, Record<string, unknown>[]>;

  const stmts = WRITE_ORDER.flatMap((c) => {
    if (rows[c].length === 0) return [];
    const data = rows[c].map((row) => {
      const out: Record<string, unknown> = { ...row, householdId };
      for (const f of TIMESTAMPS[c] ?? []) if (typeof out[f] === "string") out[f] = new Date(out[f] as string);
      if (c === "members") out.email = people[Number(String(row.id).slice(1)) - 1].email;
      return out;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return [db.insert(TABLES[c] as any).values(data as any)];
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.batch(stmts as any);
  } catch (err) {
    // The batch is atomic; remove the household row that was created before it.
    await db.delete(schema.households).where(eq(schema.households.id, householdId));
    throw err;
  }
  console.log(`Household created: ${householdId}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
