import { completeChore, toDateKey, uid } from "./logic";
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
} from "./types";

/* Pure state updaters. Each one returns a new household state. */

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

/** Puts every not-yet-bought material of a project on the shopping list (no duplicates). */
export const materialsToShopping = (projectId: string) => (s: S): S => {
  const project = s.projects.find((p) => p.id === projectId);
  if (!project) return s;
  const existing = new Set(s.shopping.filter((i) => !i.checked).map((i) => i.name.toLowerCase()));
  const add = project.materials
    .filter((m) => !m.bought && !existing.has(m.name.toLowerCase()))
    .map((m) => ({ id: uid("s"), name: m.name, checked: false, source: "project" as const }));
  return { ...s, shopping: [...s.shopping, ...add] };
};

export const categorizeTransaction = (txId: string, categoryId: string, remember: boolean) => (s: S): S => {
  const tx = s.transactions.find((t) => t.id === txId);
  const rules =
    remember && tx && !s.rules.some((r) => tx.counterparty.toLowerCase().includes(r.contains.toLowerCase()))
      ? [...s.rules, { id: uid("r"), contains: tx.counterparty.toLowerCase(), categoryId }]
      : s.rules;
  return { ...s, rules, transactions: s.transactions.map((t) => (t.id === txId ? { ...t, categoryId } : t)) };
};

export const addExpense = (amountCents: number, counterparty: string, categoryId: string, now: Date) => (s: S): S => ({
  ...s,
  transactions: [
    ...s.transactions,
    { id: uid("x"), date: toDateKey(now), counterparty, amountCents: -Math.abs(amountCents), categoryId, source: "manual" },
  ],
});

export const setBudget = (categoryId: string, budgetCents: number) => (s: S): S => ({
  ...s,
  categories: s.categories.map((c) => (c.id === categoryId ? { ...c, budgetCents } : c)),
});

export const syncBank = (now: Date) => (s: S): S => ({ ...s, bank: { ...s.bank, syncedAt: now.toISOString() } });

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

export const addShopping = (name: string) => (s: S): S => ({
  ...s,
  shopping: [...s.shopping, { id: uid("s"), name, checked: false, source: "manual" }],
});

export const clearCheckedShopping = (s: S): S => ({ ...s, shopping: s.shopping.filter((i) => !i.checked) });

/** Adds a recipe's ingredients to the shopping list, skipping ones already on it. */
export const recipeToShopping = (recipeId: string) => (s: S): S => {
  const recipe = s.recipes.find((r) => r.id === recipeId);
  if (!recipe) return s;
  const existing = new Set(s.shopping.filter((i) => !i.checked).map((i) => i.name.toLowerCase()));
  const add = recipe.ingredients
    .filter((n) => !existing.has(n.toLowerCase()))
    .map((name) => ({ id: uid("s"), name, checked: false, source: "recipe" as const }));
  return { ...s, shopping: [...s.shopping, ...add] };
};

export const planMeal = (date: string, recipeId: string, cookId: MemberId) => (s: S): S => ({
  ...s,
  mealPlan: [...s.mealPlan.filter((m) => m.date !== date), { date, recipeId, cookId }].sort((a, b) => a.date.localeCompare(b.date)),
});

export const renameMember = (id: MemberId, name: string) => (s: S): S => ({
  ...s,
  members: s.members.map((m) => (m.id === id ? { ...m, name } : m)),
});

export const setMe = (id: MemberId) => (s: S): S => ({ ...s, me: id });

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

/** Cycles a stock level; reaching "low" puts the item on the shopping list (once). */
export const cycleStock = (id: string) => (s: S): S => {
  const item = s.stock.find((x) => x.id === id);
  if (!item) return s;
  const level = NEXT_LEVEL[item.level];
  const onList = s.shopping.some((x) => !x.checked && x.name.toLowerCase() === item.name.toLowerCase());
  const shopping =
    level === "low" && !onList
      ? [...s.shopping, { id: uid("s"), name: item.name, checked: false, source: "stock" as const }]
      : s.shopping;
  return { ...s, shopping, stock: s.stock.map((x) => (x.id === id ? { ...x, level } : x)) };
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
