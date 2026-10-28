import type {
  Appointment,
  CalendarEvent,
  CareDay,
  Category,
  CategoryRule,
  Chore,
  ClothingSize,
  Dose,
  FoodTry,
  GrowthEntry,
  HomeProject,
  Material,
  MealPlanEntry,
  Medicine,
  Member,
  Milestone,
  Recipe,
  RoutineItem,
  ShoppingItem,
  Signal,
  StockItem,
  Task,
  Temperature,
  Transaction,
} from "../types";

/* Collection registry: the one place that knows how each HouseholdState array maps to rows. */

export type CollectionName =
  | "members" | "signals" | "chores" | "tasks" | "projects" | "materials" | "categories" | "transactions"
  | "rules" | "care" | "medicines" | "doses" | "temperatures" | "appointments" | "routine" | "milestones"
  | "sizes" | "stock" | "growth" | "foods" | "recipes" | "mealPlan" | "shopping" | "events";

type P<T> = T & { position: number };

export type RowMap = {
  members: P<Member>;
  signals: P<Signal>;
  chores: P<Chore>;
  tasks: P<Task>;
  projects: P<Omit<HomeProject, "materials">>;
  materials: P<Material & { projectId: string }>;
  categories: P<Category>;
  transactions: Transaction;
  rules: P<CategoryRule>;
  care: CareDay;
  medicines: P<Medicine>;
  doses: P<Dose>;
  temperatures: P<Temperature>;
  appointments: P<Appointment>;
  routine: P<RoutineItem>;
  milestones: P<Milestone>;
  sizes: P<ClothingSize>;
  stock: P<StockItem>;
  growth: P<GrowthEntry>;
  foods: P<FoodTry>;
  recipes: P<Recipe>;
  mealPlan: MealPlanEntry;
  shopping: P<ShoppingItem>;
  events: P<CalendarEvent>;
};

export type Rows = { [C in CollectionName]: RowMap[C][] };

export type Op = "insert" | "update" | "delete";

export type Change = {
  [C in CollectionName]:
    | { op: "insert"; c: C; row: RowMap[C] }
    | { op: "update"; c: C; key: string; patch: Partial<RowMap[C]> }
    | { op: "delete"; c: C; key: string };
}[CollectionName];

export type Changeset = { id: string; changes: Change[] };

type CollectionDef = {
  /** Primary key field inside the household. */
  key: string;
  /** False for care (sorted by weekday), mealPlan and transactions (sorted by date). */
  ordered: boolean;
  ops: Op[];
  /** Patch allow-list; default: all fields except the key. */
  updatable?: string[];
  /** ISO string fields stored as timestamptz. */
  timestamps: string[];
};

const ALL: Op[] = ["insert", "update", "delete"];

export const COLLECTIONS: { [C in CollectionName]: CollectionDef } = {
  members: { key: "id", ordered: true, ops: ["update"], updatable: ["name"], timestamps: [] },
  signals: { key: "id", ordered: true, ops: ["update"], timestamps: ["openedAt"] },
  chores: { key: "id", ordered: true, ops: ALL, timestamps: [] },
  tasks: { key: "id", ordered: true, ops: ALL, timestamps: ["doneAt"] },
  projects: { key: "id", ordered: true, ops: ALL, timestamps: [] },
  materials: { key: "id", ordered: true, ops: ALL, timestamps: [] },
  categories: { key: "id", ordered: true, ops: ["insert", "update"], timestamps: [] },
  // Sorted by date, not position: imports add rows on the server, and positions would shift on every delete.
  transactions: { key: "id", ordered: false, ops: ALL, updatable: ["categoryId", "counterparty", "transfer"], timestamps: [] },
  rules: { key: "id", ordered: true, ops: ALL, timestamps: [] },
  care: { key: "weekday", ordered: false, ops: ["update"], timestamps: [] },
  medicines: { key: "id", ordered: true, ops: [], timestamps: [] },
  doses: { key: "id", ordered: true, ops: ALL, timestamps: ["at"] },
  temperatures: { key: "id", ordered: true, ops: ALL, timestamps: ["at"] },
  appointments: { key: "id", ordered: true, ops: ALL, timestamps: ["at"] },
  routine: { key: "id", ordered: true, ops: [], timestamps: [] },
  milestones: { key: "id", ordered: true, ops: ALL, timestamps: [] },
  sizes: { key: "id", ordered: true, ops: ["update"], timestamps: [] },
  stock: { key: "id", ordered: true, ops: ["update"], timestamps: [] },
  growth: { key: "id", ordered: true, ops: ALL, timestamps: [] },
  foods: { key: "id", ordered: true, ops: ALL, timestamps: [] },
  recipes: { key: "id", ordered: true, ops: ALL, timestamps: [] },
  mealPlan: { key: "date", ordered: false, ops: ALL, timestamps: [] },
  shopping: { key: "id", ordered: true, ops: ALL, timestamps: [] },
  events: { key: "id", ordered: true, ops: [], timestamps: ["start"] },
};

export const COLLECTION_NAMES = Object.keys(COLLECTIONS) as CollectionName[];

/** Parents before children, so inserts satisfy foreign keys; deletes use the reverse. */
export const WRITE_ORDER: CollectionName[] = [
  "members", "categories", "recipes", "medicines", "projects", "materials",
  "signals", "chores", "tasks", "transactions", "rules", "care", "doses", "temperatures", "appointments",
  "routine", "milestones", "sizes", "stock", "growth", "foods", "mealPlan", "shopping", "events",
];

/** The key of a row as a string ("1" for care weekday 1). */
export function rowKey(c: CollectionName, row: object): string {
  return String((row as Record<string, unknown>)[COLLECTIONS[c].key]);
}
