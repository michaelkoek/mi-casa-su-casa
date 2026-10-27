import type {
  Category,
  CategoryRule,
  Chore,
  Dose,
  MemberId,
  Medicine,
  Recipe,
  ShoppingItem,
  Transaction,
} from "./types";

const HOUR = 60 * 60 * 1000;

/** Earliest moment the next dose of a medicine may be given, or null when no dose was logged. */
export function nextDoseAllowedAt(doses: Dose[], medicine: Medicine): Date | null {
  const last = doses
    .filter((d) => d.medicineId === medicine.id)
    .map((d) => new Date(d.at).getTime())
    .sort((a, b) => b - a)[0];
  if (last === undefined) return null;
  return new Date(last + medicine.intervalHours * HOUR);
}

/** Share (0–1) of the waiting time between the last dose and the next allowed one that has passed. */
export function doseProgress(doses: Dose[], medicine: Medicine, now: Date): number {
  const next = nextDoseAllowedAt(doses, medicine);
  if (!next) return 1;
  const start = next.getTime() - medicine.intervalHours * HOUR;
  const p = (now.getTime() - start) / (next.getTime() - start);
  return Math.min(1, Math.max(0, p));
}

/** Who is up for a chore. */
export function nextAssignee(chore: Chore): MemberId {
  return chore.rotation[0];
}

/** Completes a chore: rotates the assignee and moves the due date forward. */
export function completeChore(chore: Chore, today: string): Chore {
  const [first, ...rest] = chore.rotation;
  return {
    ...chore,
    rotation: [...rest, first],
    nextDue: addDays(today, chore.intervalDays),
  };
}

/** First rule whose text occurs in the counterparty decides the category. */
export function categorize(counterparty: string, rules: CategoryRule[]): string | null {
  const name = counterparty.toLowerCase();
  const hit = rules.find((r) => name.includes(r.contains.toLowerCase()));
  return hit ? hit.categoryId : null;
}

export type BudgetLine = { category: Category; spentCents: number; ratio: number; over: boolean };

/** Spending per category for one month (YYYY-MM), only negative amounts count as spending. */
export function budgetSummary(transactions: Transaction[], categories: Category[], month: string) {
  const inMonth = transactions.filter((t) => t.date.startsWith(month) && t.amountCents < 0);
  const lines: BudgetLine[] = categories.map((category) => {
    const spentCents = -inMonth
      .filter((t) => t.categoryId === category.id)
      .reduce((sum, t) => sum + t.amountCents, 0);
    const ratio = category.budgetCents > 0 ? spentCents / category.budgetCents : 0;
    return { category, spentCents, ratio, over: spentCents > category.budgetCents };
  });
  const totalSpentCents = -inMonth.reduce((sum, t) => sum + t.amountCents, 0);
  const totalBudgetCents = categories.reduce((sum, c) => sum + c.budgetCents, 0);
  const uncategorized = inMonth.filter((t) => t.categoryId === null);
  return { lines, totalSpentCents, totalBudgetCents, uncategorized };
}

/** Parses "12,50", "12.5" or "€ 12" into cents. Returns null for anything that is not a positive amount. */
export function parseEuroToCents(input: string): number | null {
  const cleaned = input.replace(/[€\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return cents > 0 ? cents : null;
}

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const euroWhole = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function formatEuro(cents: number, whole = false): string {
  const text = (whole ? euroWhole : euro).format(Math.abs(cents) / 100);
  return cents < 0 ? `− ${text}` : text;
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return toDateKey(date);
}

export function formatTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

/** "2 u 40 min", "15 min" — remaining time until a moment, never negative. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} u` : `${h} u ${m} min`;
}

/** Minutes since a moment, as a short label: "zojuist", "12 min", "3 u". */
export function minutesAgo(iso: string, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Localized weekday name for 0 (Sunday) … 6, e.g. "ma" or "maandag". */
export function weekdayName(weekday: number, style: "short" | "long" = "short"): string {
  const d = new Date(2026, 0, 4 + weekday); // 4 Jan 2026 is a Sunday
  return d.toLocaleDateString("nl-NL", { weekday: style }).replace(".", "");
}

/** Comparison key for item and recipe names: trimmed and lowercased. */
export function normalizeItem(name: string): string {
  return name.trim().toLowerCase();
}

/** Trims each name, cuts it to 100 chars, drops empties, dedupes on normalizeItem (keeps the first spelling), keeps at most `max`. */
export function cleanNames(names: string[], max = 50): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim().slice(0, 100).trim();
    const key = normalizeItem(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

/** "Pasta, tomaat\nbasilicum" -> ["Pasta", "tomaat", "basilicum"]: split on comma or newline, then cleanNames. */
export function parseIngredients(text: string): string[] {
  return cleanNames(text.split(/[,\n]/));
}

/** Recipe whose normalized name equals the normalized input, or undefined (empty input -> undefined). */
export function findRecipeByName(recipes: Recipe[], name: string): Recipe | undefined {
  const key = normalizeItem(name);
  if (!key) return undefined;
  return recipes.find((r) => normalizeItem(r.name) === key);
}

/** Ingredients that are not "in huis" (no shopping item with checked=true and the same normalized name). */
export function missingIngredients(ingredients: string[], shopping: ShoppingItem[]): string[] {
  const inHouse = new Set(shopping.filter((i) => i.checked).map((i) => normalizeItem(i.name)));
  return ingredients.filter((n) => !inHouse.has(normalizeItem(n)));
}

export type MealSuggestion = { recipe: Recipe; have: string[]; missing: string[]; score: number };

/** Ranks recipes by how much of them is in huis; recipes without ingredients are left out. */
export function suggestMeals(recipes: Recipe[], shopping: ShoppingItem[]): MealSuggestion[] {
  return recipes
    .filter((r) => r.ingredients.length > 0)
    .map((recipe) => {
      const missing = missingIngredients(recipe.ingredients, shopping);
      const missingSet = new Set(missing);
      const have = recipe.ingredients.filter((n) => !missingSet.has(n));
      return { recipe, have, missing, score: have.length / recipe.ingredients.length };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.missing.length - b.missing.length || a.recipe.name.localeCompare(b.recipe.name, "nl"),
    );
}
