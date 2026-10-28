import { shopKey } from "./insights";
import { cleanNames, completeChore, findRecipeByName, missingIngredients, normalizeItem, toDateKey, uid } from "./logic";
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

export const addDose = (medicineId: string, amount: string, by: MemberId, now: Date) => (s: S): S => ({
  ...s,
  doses: [...s.doses, { id: uid("d"), medicineId, amount, at: now.toISOString(), by }],
});

export const addTemperature = (celsius: number, now: Date) => (s: S): S => ({
  ...s,
  temperatures: [...s.temperatures, { id: uid("tp"), celsius, at: now.toISOString() }],
});

export const addAppointment = (title: string, at: string, place: string | null) => (s: S): S => ({
  ...s,
  appointments: [...s.appointments, { id: uid("a"), title, at, place }].sort((a, b) => a.at.localeCompare(b.at)),
});

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

export const setSize = (id: string, size: string, note: string | null) => (s: S): S => ({
  ...s,
  sizes: s.sizes.map((z) => (z.id === id ? { ...z, size, note } : z)),
});

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

export const addFood = (name: string, date: string, verdict: FoodVerdict) => (s: S): S => ({
  ...s,
  foods: [{ id: uid("f"), name, date, verdict }, ...s.foods],
});

const NEXT_VERDICT: Record<FoodVerdict, FoodVerdict> = { unsure: "likes", likes: "dislikes", dislikes: "unsure" };
export const cycleFood = (id: string) => (s: S): S => ({
  ...s,
  foods: s.foods.map((f) => (f.id === id ? { ...f, verdict: NEXT_VERDICT[f.verdict] } : f)),
});
