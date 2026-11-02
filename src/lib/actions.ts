import { shopKey } from "./insights";
import { canAddSignal, cleanNames, cleanSignalLabel, completeChore, findRecipeByName, MAX_CENTS, missingIngredients, normalizeItem, toDateKey, uid } from "./logic";
import type {
  CareDay,
  CareSlot,
  FoodVerdict,
  StockLevel,
  HouseholdState as S,
  MemberId,
  Priority,
  ProjectKind,
  ProjectStatus,
  ShoppingItem,
  SignalIcon,
  Task,
} from "./types";

/* Pure state updaters. Each one returns a new household state. */

type ShoppingSource = ShoppingItem["source"];

export const toggleTask = (id: string, now: Date) => (s: S): S => ({
  ...s,
  tasks: s.tasks.map((t) => (t.id === id ? { ...t, doneAt: t.doneAt ? null : now.toISOString() } : t)),
});

export const addTask = (title: string, assigneeId: MemberId, due: string | null) => (s: S): S => ({
  ...s,
  tasks: [...s.tasks, { id: uid("t"), title, assigneeId, due, dueLabel: null, doneAt: null }],
});

export const toggleSignal = (id: string, me: MemberId, now: Date) => (s: S): S => ({
  ...s,
  signals: s.signals.map((sig) =>
    sig.id === id
      ? sig.openedAt
        ? { ...sig, openedAt: null, openedBy: null }
        : { ...sig, openedAt: now.toISOString(), openedBy: me }
      : sig,
  ),
});

export const doneChore = (id: string, now: Date) => (s: S): S => ({
  ...s,
  chores: s.chores.map((c) => (c.id === id ? completeChore(c, toDateKey(now)) : c)),
});

type ChoreInput = { title: string; intervalDays: number; rotation: MemberId[]; nextDue: string };

/** Appends a chore. Title is trimmed and cut to 100 chars; empty title leaves the state unchanged. */
export const addChore = (input: ChoreInput, newId = uid("c")) => (s: S): S => {
  const title = input.title.trim().slice(0, 100);
  if (!title) return s;
  return { ...s, chores: [...s.chores, { ...input, title, id: newId }] };
};

/** Patches one chore. An empty title in the patch leaves the state unchanged. */
export const updateChore = (id: string, patch: Partial<ChoreInput>) => (s: S): S => {
  const next = { ...patch };
  if (patch.title !== undefined) {
    const title = patch.title.trim().slice(0, 100);
    if (!title) return s;
    next.title = title;
  }
  return { ...s, chores: s.chores.map((c) => (c.id === id ? { ...c, ...next } : c)) };
};

export const removeChore = (id: string) => (s: S): S => ({ ...s, chores: s.chores.filter((c) => c.id !== id) });

export const addProject = (p: { title: string; room: string; kind: ProjectKind; priority: Priority; costCents: number }) => (s: S): S => ({
  ...s,
  projects: [...s.projects, { id: uid("p"), status: "todo", materials: [], ...p }],
});

export const setProjectStatus = (id: string, status: ProjectStatus) => (s: S): S => ({
  ...s,
  projects: s.projects.map((p) => (p.id === id ? { ...p, status } : p)),
});

export const addMaterial = (projectId: string, name: string) => (s: S): S => ({
  ...s,
  projects: s.projects.map((p) =>
    p.id === projectId ? { ...p, materials: [...p.materials, { id: uid("mt"), name, bought: false }] } : p,
  ),
});

export const toggleMaterial = (projectId: string, materialId: string) => (s: S): S => ({
  ...s,
  projects: s.projects.map((p) =>
    p.id === projectId
      ? { ...p, materials: p.materials.map((m) => (m.id === materialId ? { ...m, bought: !m.bought } : m)) }
      : p,
  ),
});

type TaskInput = { title: string; assigneeId: MemberId; due: string | null };

/** Patches a task. Moving the due date clears the old dueLabel; doneAt is never touched. */
export const updateTask = (id: string, patch: Partial<TaskInput>) => (s: S): S => {
  const next: Partial<Task> = {};
  if (patch.title !== undefined) {
    const title = cleanText(patch.title, 100);
    if (!title) return s;
    next.title = title;
  }
  if (patch.assigneeId !== undefined) {
    if (!s.members.some((m) => m.id === patch.assigneeId)) return s;
    next.assigneeId = patch.assigneeId;
  }
  if (patch.due !== undefined) {
    if (patch.due !== null && !DATE_RE.test(patch.due)) return s;
    next.due = patch.due;
  }
  return {
    ...s,
    tasks: s.tasks.map((t) => {
      if (t.id !== id) return t;
      const changed = next.due !== undefined && next.due !== t.due;
      return { ...t, ...next, ...(changed ? { dueLabel: null } : {}) };
    }),
  };
};

export const removeTask = (id: string) => (s: S): S => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) });

type ProjectInput = { title: string; room: string; kind: ProjectKind; priority: Priority; costCents: number };

export const updateProject = (id: string, patch: Partial<ProjectInput>) => (s: S): S => {
  const next: Partial<ProjectInput> = {};
  if (patch.title !== undefined) {
    const title = cleanText(patch.title, 100);
    if (!title) return s;
    next.title = title;
  }
  if (patch.room !== undefined) {
    const room = cleanText(patch.room, 100);
    if (!room) return s;
    next.room = room;
  }
  if (patch.kind !== undefined) {
    if (patch.kind !== "finish" && patch.kind !== "maintenance") return s;
    next.kind = patch.kind;
  }
  if (patch.priority !== undefined) {
    if (patch.priority !== "high" && patch.priority !== "medium" && patch.priority !== "low") return s;
    next.priority = patch.priority;
  }
  if (patch.costCents !== undefined) {
    const n = patch.costCents;
    if (!Number.isInteger(n) || n < 0 || n > MAX_CENTS) return s;
    next.costCents = n;
  }
  return { ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, ...next } : p)) };
};

/** Removes the project; its materials go with it (nested), so one undo restores both. */
export const removeProject = (id: string) => (s: S): S => ({ ...s, projects: s.projects.filter((p) => p.id !== id) });

export const renameMaterial = (projectId: string, materialId: string, name: string) => (s: S): S => {
  const clean = cleanText(name, 100);
  if (!clean) return s;
  return {
    ...s,
    projects: s.projects.map((p) =>
      p.id === projectId ? { ...p, materials: p.materials.map((m) => (m.id === materialId ? { ...m, name: clean } : m)) } : p,
    ),
  };
};

export const removeMaterial = (projectId: string, materialId: string) => (s: S): S => ({
  ...s,
  projects: s.projects.map((p) => (p.id === projectId ? { ...p, materials: p.materials.filter((m) => m.id !== materialId) } : p)),
});

/** Puts every not-yet-bought material of a project on "halen" (no duplicates). */
export const materialsToShopping = (projectId: string) => (s: S): S => {
  const project = s.projects.find((p) => p.id === projectId);
  if (!project) return s;
  return needItems(project.materials.filter((m) => !m.bought).map((m) => m.name), "project")(s);
};

/** Sets the category; with `remember`, also adds a rule for the shop (all its branches) unless one already matches. */
export const categorizeTransaction = (txId: string, categoryId: string, remember: boolean) => (s: S): S => {
  const tx = s.transactions.find((t) => t.id === txId);
  const contains = tx ? shopKey(tx.counterparty) : "";
  const rules =
    remember && tx && contains && !s.rules.some((r) => tx.counterparty.toLowerCase().includes(r.contains.toLowerCase()))
      ? [...s.rules, { id: uid("r"), contains, categoryId }]
      : s.rules;
  return { ...s, rules, transactions: s.transactions.map((t) => (t.id === txId ? { ...t, categoryId } : t)) };
};

export const addExpense = (amountCents: number, counterparty: string, categoryId: string, now: Date) => (s: S): S => ({
  ...s,
  transactions: [
    ...s.transactions,
    {
      id: uid("x"), date: toDateKey(now), counterparty, amountCents: -Math.abs(amountCents), categoryId,
      source: "manual", accountId: null, description: null, transfer: false,
    },
  ],
});

export const setBudget = (categoryId: string, budgetCents: number | null) => (s: S): S => ({
  ...s,
  categories: s.categories.map((c) => (c.id === categoryId ? { ...c, budgetCents } : c)),
});

/** Marks a transaction as a transfer between own accounts (or back), so totals skip it. */
export const setTransfer = (txId: string, transfer: boolean) => (s: S): S => ({
  ...s,
  transactions: s.transactions.map((t) => (t.id === txId ? { ...t, transfer } : t)),
});

export const addCategory = (name: string, budgetCents: number | null) => (s: S): S => ({
  ...s,
  categories: [...s.categories, { id: uid("k"), name, budgetCents }],
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Trims, then cuts to `max` characters. */
const cleanText = (v: string, max: number): string => v.trim().slice(0, max);
/** ISO input normalised, or null when it is not a moment. */
const isoOrNull = (v: string): string | null => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const addDose = (medicineId: string, amount: string, by: MemberId, at: Date) => (s: S): S => ({
  ...s,
  doses: [...s.doses, { id: uid("d"), medicineId, amount, at: at.toISOString(), by }],
});

/** Patches medicine, amount and time of a dose; `by` never changes. An unknown medicine or invalid time leaves the state unchanged. */
export const updateDose = (id: string, patch: Partial<{ medicineId: string; amount: string; at: string }>) => (s: S): S => {
  const next: Partial<{ medicineId: string; amount: string; at: string }> = {};
  if (patch.medicineId !== undefined) {
    if (!s.medicines.some((m) => m.id === patch.medicineId)) return s;
    next.medicineId = patch.medicineId;
  }
  if (patch.amount !== undefined) next.amount = cleanText(patch.amount, 200);
  if (patch.at !== undefined) {
    const at = isoOrNull(patch.at);
    if (!at) return s;
    next.at = at;
  }
  return { ...s, doses: s.doses.map((d) => (d.id === id ? { ...d, ...next } : d)) };
};

export const removeDose = (id: string) => (s: S): S => ({ ...s, doses: s.doses.filter((d) => d.id !== id) });

export const addTemperature = (celsius: number, at: Date) => (s: S): S => ({
  ...s,
  temperatures: [...s.temperatures, { id: uid("tp"), celsius, at: at.toISOString() }],
});

export const updateTemperature = (id: string, patch: Partial<{ celsius: number; at: string }>) => (s: S): S => {
  const next: Partial<{ celsius: number; at: string }> = {};
  if (patch.celsius !== undefined) {
    if (!Number.isFinite(patch.celsius) || patch.celsius < 30 || patch.celsius > 45) return s;
    next.celsius = patch.celsius;
  }
  if (patch.at !== undefined) {
    const at = isoOrNull(patch.at);
    if (!at) return s;
    next.at = at;
  }
  return { ...s, temperatures: s.temperatures.map((x) => (x.id === id ? { ...x, ...next } : x)) };
};

export const removeTemperature = (id: string) => (s: S): S => ({
  ...s,
  temperatures: s.temperatures.filter((x) => x.id !== id),
});

export const addAppointment = (title: string, at: string, place: string | null) => (s: S): S => ({
  ...s,
  appointments: [...s.appointments, { id: uid("a"), title, at, place }].sort((a, b) => a.at.localeCompare(b.at)),
});

export const updateAppointment = (id: string, patch: Partial<{ title: string; at: string; place: string | null }>) => (s: S): S => {
  const next: Partial<{ title: string; at: string; place: string | null }> = {};
  if (patch.title !== undefined) {
    const title = cleanText(patch.title, 100);
    if (!title) return s;
    next.title = title;
  }
  if (patch.at !== undefined) {
    const at = isoOrNull(patch.at);
    if (!at) return s;
    next.at = at;
  }
  if (patch.place !== undefined) next.place = patch.place === null ? null : cleanText(patch.place, 200) || null;
  return {
    ...s,
    appointments: s.appointments.map((a) => (a.id === id ? { ...a, ...next } : a)).sort((a, b) => a.at.localeCompare(b.at)),
  };
};

export const removeAppointment = (id: string) => (s: S): S => ({
  ...s,
  appointments: s.appointments.filter((a) => a.id !== id),
});

/** Cycles who brings or picks up on a weekday: me → partner → grandma → nobody (child at home). */
export const cycleCare = (weekday: CareDay["weekday"], field: "bring" | "pick") => (s: S): S => {
  const options: CareDay["bring"][] = [...s.members.map((m) => m.id), "grandma"];
  return {
    ...s,
    care: s.care.map((d) => {
      if (d.weekday !== weekday) return d;
      if (d.atHome) return { ...d, atHome: false, bring: options[0], pick: options[1] ?? options[0] };
      const i = options.indexOf(d[field]);
      if (i === options.length - 1) return { ...d, atHome: true, bring: null, pick: null };
      return { ...d, [field]: options[i + 1] };
    }),
  };
};

export const toggleShopping = (id: string) => (s: S): S => ({
  ...s,
  shopping: s.shopping.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
});

/**
 * The one way to put things on "halen": existing items with the same name are set back to unchecked,
 * new names are appended. Never creates duplicates. Returns the same state when nothing changes.
 */
export const needItems = (names: string[], source: ShoppingSource) => (s: S): S => {
  let changed = false;
  let shopping = s.shopping;
  for (const name of cleanNames(names)) {
    const key = normalizeItem(name);
    if (shopping.some((i) => normalizeItem(i.name) === key)) {
      if (shopping.some((i) => normalizeItem(i.name) === key && i.checked)) {
        shopping = shopping.map((i) => (normalizeItem(i.name) === key && i.checked ? { ...i, checked: false } : i));
        changed = true;
      }
    } else {
      shopping = [...shopping, { id: uid("s"), name, checked: false, source }];
      changed = true;
    }
  }
  return changed ? { ...s, shopping } : s;
};

export const addShopping = (name: string) => needItems([name], "manual");

/** Permanently removes one item. */
export const deleteShopping = (id: string) => (s: S): S => ({ ...s, shopping: s.shopping.filter((i) => i.id !== id) });

/** Puts only ingredients that are not in huis on "halen". */
export const missingToShopping = (ingredients: string[]) => (s: S): S =>
  needItems(missingIngredients(ingredients, s.shopping), "recipe")(s);

/** Replaces the entry for `date` and keeps mealPlan sorted by date. */
export const planMeal = (date: string, meal: { title: string; recipeId: string | null; cookId: MemberId }) => (s: S): S => ({
  ...s,
  mealPlan: [...s.mealPlan.filter((m) => m.date !== date), { date, ...meal }].sort((a, b) => a.date.localeCompare(b.date)),
});

/** Removes the entry for `date` (no-op when there is none). */
export const clearMeal = (date: string) => (s: S): S =>
  s.mealPlan.some((m) => m.date === date) ? { ...s, mealPlan: s.mealPlan.filter((m) => m.date !== date) } : s;

/** Upserts a recipe by normalized name; an existing match keeps its id, name and position. */
export const saveRecipe = (name: string, ingredients: string[], newId = uid("rc")) => (s: S): S => {
  const title = name.trim().slice(0, 100);
  if (!title) return s;
  const list = cleanNames(ingredients);
  const existing = findRecipeByName(s.recipes, title);
  if (existing) {
    return { ...s, recipes: s.recipes.map((r) => (r.id === existing.id ? { ...r, ingredients: list } : r)) };
  }
  return { ...s, recipes: [...s.recipes, { id: newId, name: title, ingredients: list }] };
};

/** Opslaan of the plan sheet as one updater (one changeset, one undo). */
export const planDay = (date: string, input: { title: string; ingredients: string[]; cookId: MemberId }) => (s: S): S => {
  const title = input.title.trim().slice(0, 100);
  if (!title) return s;
  const ingredients = cleanNames(input.ingredients);
  const existing = findRecipeByName(s.recipes, title);
  if (ingredients.length === 0) {
    return planMeal(date, { title, recipeId: existing?.id ?? null, cookId: input.cookId })(s);
  }
  const recipeId = existing?.id ?? uid("rc");
  return missingToShopping(ingredients)(
    planMeal(date, { title, recipeId, cookId: input.cookId })(saveRecipe(title, ingredients, recipeId)(s)),
  );
};

export const renameMember = (id: MemberId, name: string) => (s: S): S => ({
  ...s,
  members: s.members.map((m) => (m.id === id ? { ...m, name } : m)),
});

export const addMilestone = (text: string, date: string) => (s: S): S => ({
  ...s,
  milestones: [{ id: uid("ms"), date, text }, ...s.milestones],
});

export const updateMilestone = (id: string, patch: Partial<{ text: string; date: string }>) => (s: S): S => {
  const next: Partial<{ text: string; date: string }> = {};
  if (patch.text !== undefined) {
    const text = cleanText(patch.text, 500);
    if (!text) return s;
    next.text = text;
  }
  if (patch.date !== undefined) {
    if (!DATE_RE.test(patch.date)) return s;
    next.date = patch.date;
  }
  return { ...s, milestones: s.milestones.map((m) => (m.id === id ? { ...m, ...next } : m)) };
};

export const removeMilestone = (id: string) => (s: S): S => ({ ...s, milestones: s.milestones.filter((m) => m.id !== id) });

/** "Ik haal op": set who brings or picks up on a weekday (the day is no longer a home day). */
export const claimCare = (weekday: CareDay["weekday"], field: "bring" | "pick", who: CareSlot) => (s: S): S => ({
  ...s,
  care: s.care.map((d) =>
    d.weekday === weekday
      ? { ...d, atHome: false, bring: field === "bring" ? who : d.bring ?? who, pick: field === "pick" ? who : d.pick ?? who }
      : d,
  ),
});

export const setHomeDay = (weekday: CareDay["weekday"], atHome: boolean) => (s: S): S => ({
  ...s,
  care: s.care.map((d) => (d.weekday === weekday ? { ...d, atHome } : d)),
});

type SizeInput = { label: string; size: string; note: string | null };

export const addSize = (input: SizeInput, newId = uid("z")) => (s: S): S => {
  const label = cleanText(input.label, 100);
  const size = cleanText(input.size, 40);
  if (!label || !size) return s;
  const note = input.note === null ? null : cleanText(input.note, 200) || null;
  return { ...s, sizes: [...s.sizes, { id: newId, label, size, note }] };
};

export const updateSize = (id: string, patch: Partial<SizeInput>) => (s: S): S => {
  const next: Partial<SizeInput> = {};
  if (patch.label !== undefined) {
    const label = cleanText(patch.label, 100);
    if (!label) return s;
    next.label = label;
  }
  if (patch.size !== undefined) {
    const size = cleanText(patch.size, 40);
    if (!size) return s;
    next.size = size;
  }
  if (patch.note !== undefined) next.note = patch.note === null ? null : cleanText(patch.note, 200) || null;
  return { ...s, sizes: s.sizes.map((z) => (z.id === id ? { ...z, ...next } : z)) };
};

export const removeSize = (id: string) => (s: S): S => ({ ...s, sizes: s.sizes.filter((z) => z.id !== id) });

/** Appends a stock item at level "full". Empty name leaves the state unchanged. */
export const addStock = (name: string, newId = uid("st")) => (s: S): S => {
  const clean = cleanText(name, 100);
  if (!clean) return s;
  return { ...s, stock: [...s.stock, { id: newId, name: clean, level: "full" }] };
};

export const renameStock = (id: string, name: string) => (s: S): S => {
  const clean = cleanText(name, 100);
  if (!clean) return s;
  return { ...s, stock: s.stock.map((x) => (x.id === id ? { ...x, name: clean } : x)) };
};

export const removeStock = (id: string) => (s: S): S => ({ ...s, stock: s.stock.filter((x) => x.id !== id) });

const NEXT_LEVEL: Record<StockLevel, StockLevel> = { full: "half", half: "low", low: "full" };

/** Cycles a stock level; reaching "low" puts the item on "halen" (once). */
export const cycleStock = (id: string) => (s: S): S => {
  const item = s.stock.find((x) => x.id === id);
  if (!item) return s;
  const level = NEXT_LEVEL[item.level];
  const next = { ...s, stock: s.stock.map((x) => (x.id === id ? { ...x, level } : x)) };
  return level === "low" ? needItems([item.name], "stock")(next) : next;
};

export const addGrowth = (weightGrams: number, lengthCm: number, date: string) => (s: S): S => ({
  ...s,
  growth: [...s.growth, { id: uid("g"), date, weightGrams, lengthCm }].sort((a, b) => a.date.localeCompare(b.date)),
});

export const updateGrowth = (id: string, patch: Partial<{ weightGrams: number; lengthCm: number; date: string }>) => (s: S): S => {
  const next: Partial<{ weightGrams: number; lengthCm: number; date: string }> = {};
  if (patch.weightGrams !== undefined) {
    if (!Number.isInteger(patch.weightGrams) || patch.weightGrams < 0 || patch.weightGrams > 200000) return s;
    next.weightGrams = patch.weightGrams;
  }
  if (patch.lengthCm !== undefined) {
    if (!Number.isFinite(patch.lengthCm) || patch.lengthCm < 0 || patch.lengthCm > 250) return s;
    next.lengthCm = patch.lengthCm;
  }
  if (patch.date !== undefined) {
    if (!DATE_RE.test(patch.date)) return s;
    next.date = patch.date;
  }
  return { ...s, growth: s.growth.map((g) => (g.id === id ? { ...g, ...next } : g)).sort((a, b) => a.date.localeCompare(b.date)) };
};

export const removeGrowth = (id: string) => (s: S): S => ({ ...s, growth: s.growth.filter((g) => g.id !== id) });

export const addFood = (name: string, date: string, verdict: FoodVerdict) => (s: S): S => ({
  ...s,
  foods: [{ id: uid("f"), name, date, verdict }, ...s.foods],
});

const NEXT_VERDICT: Record<FoodVerdict, FoodVerdict> = { unsure: "likes", likes: "dislikes", dislikes: "unsure" };
export const cycleFood = (id: string) => (s: S): S => ({
  ...s,
  foods: s.foods.map((f) => (f.id === id ? { ...f, verdict: NEXT_VERDICT[f.verdict] } : f)),
});

export const updateFood = (id: string, patch: Partial<{ name: string; verdict: FoodVerdict }>) => (s: S): S => {
  const next: Partial<{ name: string; verdict: FoodVerdict }> = {};
  if (patch.name !== undefined) {
    const name = cleanText(patch.name, 100);
    if (!name) return s;
    next.name = name;
  }
  if (patch.verdict !== undefined) next.verdict = patch.verdict;
  return { ...s, foods: s.foods.map((f) => (f.id === id ? { ...f, ...next } : f)) };
};

export const removeFood = (id: string) => (s: S): S => ({ ...s, foods: s.foods.filter((f) => f.id !== id) });

type RoutineInput = { time: string; label: string };

const byTime = <T extends { time: string }>(list: T[]): T[] => [...list].sort((a, b) => a.time.localeCompare(b.time));

export const addRoutine = (input: RoutineInput, newId = uid("rt")) => (s: S): S => {
  const label = cleanText(input.label, 100);
  if (!label || !TIME_RE.test(input.time)) return s;
  return { ...s, routine: byTime([...s.routine, { id: newId, time: input.time, label }]) };
};

export const updateRoutine = (id: string, patch: Partial<RoutineInput>) => (s: S): S => {
  const next: Partial<RoutineInput> = {};
  if (patch.time !== undefined) {
    if (!TIME_RE.test(patch.time)) return s;
    next.time = patch.time;
  }
  if (patch.label !== undefined) {
    const label = cleanText(patch.label, 100);
    if (!label) return s;
    next.label = label;
  }
  return { ...s, routine: byTime(s.routine.map((r) => (r.id === id ? { ...r, ...next } : r))) };
};

export const removeRoutine = (id: string) => (s: S): S => ({ ...s, routine: s.routine.filter((r) => r.id !== id) });

type MedicineInput = { name: string; intervalHours: number };

const validHours = (n: number) => Number.isInteger(n) && n >= 1 && n <= 72;

export const addMedicine = (input: MedicineInput, newId = uid("md")) => (s: S): S => {
  const name = cleanText(input.name, 100);
  if (!name || !validHours(input.intervalHours)) return s;
  return { ...s, medicines: [...s.medicines, { id: newId, name, intervalHours: input.intervalHours }] };
};

export const updateMedicine = (id: string, patch: Partial<MedicineInput>) => (s: S): S => {
  const next: Partial<MedicineInput> = {};
  if (patch.name !== undefined) {
    const name = cleanText(patch.name, 100);
    if (!name) return s;
    next.name = name;
  }
  if (patch.intervalHours !== undefined) {
    if (!validHours(patch.intervalHours)) return s;
    next.intervalHours = patch.intervalHours;
  }
  return { ...s, medicines: s.medicines.map((m) => (m.id === id ? { ...m, ...next } : m)) };
};

/** Removes the medicine and every dose of it in one updater, so one undo restores both. */
export const removeMedicine = (id: string) => (s: S): S => ({
  ...s,
  medicines: s.medicines.filter((m) => m.id !== id),
  doses: s.doses.filter((d) => d.medicineId !== id),
});

type SignalInput = { label: string; icon: SignalIcon };

/** Appends a closed signal. Empty label or MAX_SIGNALS reached leaves the state unchanged. */
export const addSignal = (input: SignalInput, newId = uid("sg")) => (s: S): S => {
  const label = cleanSignalLabel(input.label);
  if (!label || !canAddSignal(s.signals)) return s;
  return { ...s, signals: [...s.signals, { id: newId, label, icon: input.icon, openedBy: null, openedAt: null }] };
};

/** Changes label and icon only; the open state stays. Empty label leaves the state unchanged. */
export const updateSignal = (id: string, input: SignalInput) => (s: S): S => {
  const label = cleanSignalLabel(input.label);
  if (!label) return s;
  return { ...s, signals: s.signals.map((x) => (x.id === id ? { ...x, label, icon: input.icon } : x)) };
};

export const removeSignal = (id: string) => (s: S): S => ({ ...s, signals: s.signals.filter((x) => x.id !== id) });
