export type MemberId = string;

export type Member = { id: MemberId; name: string };

export type SignalIcon = "trash" | "paper" | "laundry" | "dishwasher" | "diaper" | "glass";

export type Signal = {
  id: string;
  label: string;
  icon: SignalIcon;
  openedBy: MemberId | null;
  openedAt: string | null;
};

export type Chore = {
  id: string;
  title: string;
  intervalDays: number;
  /** Rotation order; the first entry is up next. */
  rotation: MemberId[];
  nextDue: string; // YYYY-MM-DD
};

export type Task = {
  id: string;
  title: string;
  assigneeId: MemberId;
  due: string | null; // YYYY-MM-DD
  dueLabel: string | null;
  doneAt: string | null;
};

export type Priority = "high" | "medium" | "low";
export type ProjectKind = "finish" | "maintenance";
export type ProjectStatus = "todo" | "doing" | "done";

export type Material = { id: string; name: string; bought: boolean };

export type HomeProject = {
  id: string;
  title: string;
  room: string;
  kind: ProjectKind;
  priority: Priority;
  status: ProjectStatus;
  costCents: number;
  materials: Material[];
};

export type Category = { id: string; name: string; budgetCents: number };

export type Transaction = {
  id: string;
  date: string; // YYYY-MM-DD
  counterparty: string;
  amountCents: number; // negative = spent
  categoryId: string | null;
  source: "bank" | "manual";
};

export type CategoryRule = { id: string; contains: string; categoryId: string };

export type CareSlot = MemberId | "grandma" | null;
export type CareDay = { weekday: 1 | 2 | 3 | 4 | 5; atHome: boolean; bring: CareSlot; pick: CareSlot };

export type Medicine = { id: string; name: string; intervalHours: number };
export type Dose = { id: string; medicineId: string; amount: string; at: string; by: MemberId };
export type Temperature = { id: string; celsius: number; at: string };

export type Appointment = { id: string; title: string; at: string; place: string | null };

export type Recipe = { id: string; name: string; ingredients: string[] };
export type MealPlanEntry = { date: string; recipeId: string; cookId: MemberId };
export type ShoppingItem = { id: string; name: string; checked: boolean; source: "manual" | "recipe" | "project" | "stock" };

export type CalendarEvent = { id: string; title: string; start: string; allDay: boolean };

export type ClothingSize = { id: string; label: string; size: string; note: string | null };
export type StockLevel = "full" | "half" | "low";
export type StockItem = { id: string; name: string; level: StockLevel };
export type GrowthEntry = { id: string; date: string; weightGrams: number; lengthCm: number };
export type FoodVerdict = "likes" | "dislikes" | "unsure";
export type FoodTry = { id: string; name: string; date: string; verdict: FoodVerdict };

export type Milestone = { id: string; date: string; text: string };

export type RoutineItem = { id: string; time: string; label: string };

export type BankStatus = { name: string; syncedAt: string; consentUntil: string };

export type HouseholdState = {
  version: 1;
  me: MemberId;
  members: Member[];
  signals: Signal[];
  chores: Chore[];
  tasks: Task[];
  projects: HomeProject[];
  categories: Category[];
  transactions: Transaction[];
  rules: CategoryRule[];
  /** Null until the bank link exists (phase 3). */
  bank: BankStatus | null;
  care: CareDay[];
  medicines: Medicine[];
  doses: Dose[];
  temperatures: Temperature[];
  appointments: Appointment[];
  routine: RoutineItem[];
  milestones: Milestone[];
  sizes: ClothingSize[];
  stock: StockItem[];
  growth: GrowthEntry[];
  foods: FoodTry[];
  recipes: Recipe[];
  mealPlan: MealPlanEntry[];
  shopping: ShoppingItem[];
  events: CalendarEvent[];
};
