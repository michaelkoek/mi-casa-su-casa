import {
  boolean,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  date as pgDate,
} from "drizzle-orm/pg-core";
import type {
  CareSlot,
  FoodVerdict,
  Priority,
  ProjectKind,
  ProjectStatus,
  SignalIcon,
  StockLevel,
} from "../lib/types";
import { user } from "./auth-schema";

export * from "./auth-schema";

/*
 * Every domain table is keyed (household_id, key). References between tables are
 * composite foreign keys (household_id, col) -> (household_id, id), so a row can
 * never point at another household. Property names equal the sync Row fields.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const day = (name: string) => pgDate(name, { mode: "string" });

const stamps = {
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
};

const hid = () =>
  uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" });

const pos = () => integer("position").notNull().default(0);

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    householdId: hid(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    userId: text("user_id").unique().references(() => user.id, { onDelete: "set null" }),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const signals = pgTable(
  "signals",
  {
    householdId: hid(),
    id: text("id").notNull(),
    label: text("label").notNull(),
    icon: text("icon").$type<SignalIcon>().notNull(),
    openedBy: text("opened_by"),
    openedAt: ts("opened_at"),
    position: pos(),
    ...stamps,
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.id] }),
    foreignKey({ columns: [t.householdId, t.openedBy], foreignColumns: [members.householdId, members.id] }),
  ],
);

export const chores = pgTable(
  "chores",
  {
    householdId: hid(),
    id: text("id").notNull(),
    title: text("title").notNull(),
    intervalDays: integer("interval_days").notNull(),
    rotation: text("rotation").array().notNull(),
    nextDue: day("next_due").notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const tasks = pgTable(
  "tasks",
  {
    householdId: hid(),
    id: text("id").notNull(),
    title: text("title").notNull(),
    assigneeId: text("assignee_id").notNull(),
    due: day("due"),
    dueLabel: text("due_label"),
    doneAt: ts("done_at"),
    position: pos(),
    ...stamps,
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.id] }),
    foreignKey({ columns: [t.householdId, t.assigneeId], foreignColumns: [members.householdId, members.id] }),
  ],
);

export const projects = pgTable(
  "projects",
  {
    householdId: hid(),
    id: text("id").notNull(),
    title: text("title").notNull(),
    room: text("room").notNull(),
    kind: text("kind").$type<ProjectKind>().notNull(),
    priority: text("priority").$type<Priority>().notNull(),
    status: text("status").$type<ProjectStatus>().notNull(),
    costCents: integer("cost_cents").notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const materials = pgTable(
  "materials",
  {
    householdId: hid(),
    id: text("id").notNull(),
    projectId: text("project_id").notNull(),
    name: text("name").notNull(),
    bought: boolean("bought").notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.id] }),
    foreignKey({ columns: [t.householdId, t.projectId], foreignColumns: [projects.householdId, projects.id] }).onDelete("cascade"),
  ],
);

export const categories = pgTable(
  "categories",
  {
    householdId: hid(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    budgetCents: integer("budget_cents").notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const transactions = pgTable(
  "transactions",
  {
    householdId: hid(),
    id: text("id").notNull(),
    date: day("date").notNull(),
    counterparty: text("counterparty").notNull(),
    amountCents: integer("amount_cents").notNull(),
    categoryId: text("category_id"),
    source: text("source").$type<"bank" | "manual">().notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.id] }),
    foreignKey({ columns: [t.householdId, t.categoryId], foreignColumns: [categories.householdId, categories.id] }),
  ],
);

export const categoryRules = pgTable(
  "category_rules",
  {
    householdId: hid(),
    id: text("id").notNull(),
    contains: text("contains").notNull(),
    categoryId: text("category_id").notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.id] }),
    foreignKey({ columns: [t.householdId, t.categoryId], foreignColumns: [categories.householdId, categories.id] }),
  ],
);

export const careDays = pgTable(
  "care_days",
  {
    householdId: hid(),
    weekday: smallint("weekday").$type<1 | 2 | 3 | 4 | 5>().notNull(),
    atHome: boolean("at_home").notNull(),
    bring: text("bring").$type<CareSlot>(),
    pick: text("pick").$type<CareSlot>(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.weekday] })],
);

export const medicines = pgTable(
  "medicines",
  {
    householdId: hid(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    intervalHours: integer("interval_hours").notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const doses = pgTable(
  "doses",
  {
    householdId: hid(),
    id: text("id").notNull(),
    medicineId: text("medicine_id").notNull(),
    amount: text("amount").notNull(),
    at: ts("at").notNull(),
    by: text("given_by").notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.id] }),
    foreignKey({ columns: [t.householdId, t.medicineId], foreignColumns: [medicines.householdId, medicines.id] }),
    foreignKey({ columns: [t.householdId, t.by], foreignColumns: [members.householdId, members.id] }),
  ],
);

export const temperatures = pgTable(
  "temperatures",
  {
    householdId: hid(),
    id: text("id").notNull(),
    celsius: doublePrecision("celsius").notNull(),
    at: ts("at").notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const appointments = pgTable(
  "appointments",
  {
    householdId: hid(),
    id: text("id").notNull(),
    title: text("title").notNull(),
    at: ts("at").notNull(),
    place: text("place"),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const routineItems = pgTable(
  "routine_items",
  {
    householdId: hid(),
    id: text("id").notNull(),
    time: text("time").notNull(),
    label: text("label").notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const milestones = pgTable(
  "milestones",
  {
    householdId: hid(),
    id: text("id").notNull(),
    date: day("date").notNull(),
    text: text("text").notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const clothingSizes = pgTable(
  "clothing_sizes",
  {
    householdId: hid(),
    id: text("id").notNull(),
    label: text("label").notNull(),
    size: text("size").notNull(),
    note: text("note"),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const stockItems = pgTable(
  "stock_items",
  {
    householdId: hid(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    level: text("level").$type<StockLevel>().notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const growthEntries = pgTable(
  "growth_entries",
  {
    householdId: hid(),
    id: text("id").notNull(),
    date: day("date").notNull(),
    weightGrams: integer("weight_grams").notNull(),
    lengthCm: doublePrecision("length_cm").notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const foodTries = pgTable(
  "food_tries",
  {
    householdId: hid(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    date: day("date").notNull(),
    verdict: text("verdict").$type<FoodVerdict>().notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const recipes = pgTable(
  "recipes",
  {
    householdId: hid(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    ingredients: text("ingredients").array().notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const mealPlan = pgTable(
  "meal_plan",
  {
    householdId: hid(),
    date: day("date").notNull(),
    title: text("title").notNull(),
    recipeId: text("recipe_id"),
    cookId: text("cook_id").notNull(),
    ...stamps,
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.date] }),
    foreignKey({ columns: [t.householdId, t.recipeId], foreignColumns: [recipes.householdId, recipes.id] }),
    foreignKey({ columns: [t.householdId, t.cookId], foreignColumns: [members.householdId, members.id] }),
  ],
);

export const shoppingItems = pgTable(
  "shopping_items",
  {
    householdId: hid(),
    id: text("id").notNull(),
    name: text("name").notNull(),
    checked: boolean("checked").notNull(),
    source: text("source").$type<"manual" | "recipe" | "project" | "stock">().notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    householdId: hid(),
    id: text("id").notNull(),
    title: text("title").notNull(),
    start: ts("start").notNull(),
    allDay: boolean("all_day").notNull(),
    position: pos(),
    ...stamps,
  },
  (t) => [primaryKey({ columns: [t.householdId, t.id] })],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: hid(),
    memberId: text("member_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    lastSuccessAt: ts("last_success_at"),
  },
  (t) => [
    foreignKey({ columns: [t.householdId, t.memberId], foreignColumns: [members.householdId, members.id] }).onDelete("cascade"),
    index("push_subscriptions_household_member_idx").on(t.householdId, t.memberId),
  ],
);

