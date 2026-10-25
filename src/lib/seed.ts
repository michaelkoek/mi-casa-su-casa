import { addDays, toDateKey } from "./logic";
import type { HouseholdState } from "./types";

/**
 * Demo data for the prototype. Everything is placed relative to "now" so the
 * app looks alive whenever it is opened. Replaced by Neon data in phase 1.
 */
export function createSeed(now = new Date()): HouseholdState {
  const today = toDateKey(now);
  const month = today.slice(0, 7);
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString();
  const at = (days: number, hh: number, mm: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  };
  const day = (n: number) => `${month}-${String(Math.min(n, now.getDate())).padStart(2, "0")}`;

  return {
    version: 1,
    me: "m1",
    members: [
      { id: "m1", name: "Michael" },
      { id: "m2", name: "Partner" },
    ],
    signals: [
      { id: "trash", label: "Prullenbak vol", icon: "trash", openedBy: "m2", openedAt: ago(12) },
      { id: "paper", label: "Papier vol", icon: "paper", openedBy: null, openedAt: null },
      { id: "laundry", label: "Wasmand vol", icon: "laundry", openedBy: null, openedAt: null },
      { id: "dishwasher", label: "Vaatwasser schoon", icon: "dishwasher", openedBy: null, openedAt: null },
      { id: "diaper", label: "Luiers bijna op", icon: "diaper", openedBy: null, openedAt: null },
      { id: "glass", label: "Glas wegbrengen", icon: "glass", openedBy: null, openedAt: null },
    ],
    chores: [
      { id: "c1", title: "Stofzuigen", intervalDays: 7, rotation: ["m1", "m2"], nextDue: addDays(today, 2) },
      { id: "c2", title: "Badkamer schoonmaken", intervalDays: 7, rotation: ["m2", "m1"], nextDue: addDays(today, 4) },
      { id: "c3", title: "Bedden verschonen", intervalDays: 14, rotation: ["m1", "m2"], nextDue: today },
      { id: "c4", title: "Koelkast uitmesten", intervalDays: 14, rotation: ["m2", "m1"], nextDue: addDays(today, 9) },
    ],
    tasks: [
      { id: "t1", title: "Was ophangen", assigneeId: "m1", due: today, dueLabel: null, doneAt: null },
      { id: "t2", title: "Planten water geven", assigneeId: "m2", due: today, dueLabel: null, doneAt: ago(90) },
      { id: "t3", title: "Container aan de straat", assigneeId: "m1", due: today, dueLabel: "voor 19:00", doneAt: null },
      { id: "t4", title: "Luiertas inpakken", assigneeId: "m2", due: today, dueLabel: "vanavond", doneAt: null },
      { id: "t5", title: "Gemeente bellen over parkeervergunning", assigneeId: "m1", due: addDays(today, 3), dueLabel: null, doneAt: null },
    ],
    projects: [
      {
        id: "p1", title: "Meterkast dichtmaken", room: "Hal", kind: "finish", priority: "high", status: "doing", costCents: 18000,
        materials: [
          { id: "mt1", name: "Deur 60 cm", bought: true },
          { id: "mt2", name: "Plexiglas bovenlicht", bought: false },
          { id: "mt3", name: "Scharnieren", bought: false },
        ],
      },
      {
        id: "p2", title: "Trapleuning monteren", room: "Trap", kind: "finish", priority: "high", status: "todo", costCents: 9500,
        materials: [
          { id: "mt4", name: "Leuning eiken 3 m", bought: false },
          { id: "mt5", name: "Leuninghouders (4)", bought: false },
        ],
      },
      { id: "p3", title: "Kitranden badkamer vervangen", room: "Badkamer", kind: "maintenance", priority: "medium", status: "todo", costCents: 2500, materials: [{ id: "mt6", name: "Sanitairkit wit", bought: false }] },
      { id: "p4", title: "Schutting beitsen", room: "Tuin", kind: "maintenance", priority: "low", status: "todo", costCents: 4500, materials: [] },
    ],
    categories: [
      { id: "food", name: "Boodschappen", budgetCents: 45000 },
      { id: "child", name: "Kind", budgetCents: 25000 },
      { id: "home", name: "Huis en klussen", budgetCents: 20000 },
      { id: "transport", name: "Vervoer", budgetCents: 15000 },
      { id: "out", name: "Uit eten", budgetCents: 10000 },
    ],
    transactions: [
      { id: "x01", date: day(2), counterparty: "Albert Heijn 1342", amountCents: -8734, categoryId: "food", source: "bank" },
      { id: "x02", date: day(4), counterparty: "Kinderopvang De Vlinder", amountCents: -14200, categoryId: "child", source: "bank" },
      { id: "x03", date: day(5), counterparty: "Praxis Utrecht", amountCents: -16450, categoryId: "home", source: "bank" },
      { id: "x04", date: day(7), counterparty: "Jumbo Leidsche Rijn", amountCents: -6312, categoryId: "food", source: "bank" },
      { id: "x05", date: day(9), counterparty: "NS Reizigers", amountCents: -2380, categoryId: "transport", source: "bank" },
      { id: "x06", date: day(11), counterparty: "Albert Heijn 1342", amountCents: -9121, categoryId: "food", source: "bank" },
      { id: "x07", date: day(12), counterparty: "Hema", amountCents: -4415, categoryId: "child", source: "bank" },
      { id: "x08", date: day(14), counterparty: "Shell Express", amountCents: -7220, categoryId: "transport", source: "bank" },
      { id: "x09", date: day(16), counterparty: "Brasserie Olivier", amountCents: -7400, categoryId: "out", source: "bank" },
      { id: "x10", date: day(18), counterparty: "Praxis Utrecht", amountCents: -7650, categoryId: "home", source: "bank" },
      { id: "x11", date: day(20), counterparty: "Albert Heijn 1342", amountCents: -4955, categoryId: "food", source: "bank" },
      { id: "x12", date: day(21), counterparty: "Gamma Utrecht", amountCents: -4215, categoryId: null, source: "bank" },
      { id: "x13", date: day(22), counterparty: "Kruidvat", amountCents: -1849, categoryId: null, source: "bank" },
      { id: "x14", date: day(23), counterparty: "NS Reizigers", amountCents: -980, categoryId: null, source: "bank" },
    ],
    rules: [
      { id: "r1", contains: "albert heijn", categoryId: "food" },
      { id: "r2", contains: "jumbo", categoryId: "food" },
      { id: "r3", contains: "praxis", categoryId: "home" },
      { id: "r4", contains: "kinderopvang", categoryId: "child" },
      { id: "r5", contains: "shell", categoryId: "transport" },
    ],
    bank: { name: "ING", syncedAt: at(0, 7, 2), consentUntil: at(74, 9, 0) },
    care: [
      { weekday: 1, atHome: false, bring: "m1", pick: "m2" },
      { weekday: 2, atHome: false, bring: "m2", pick: "m1" },
      { weekday: 3, atHome: true, bring: null, pick: null },
      { weekday: 4, atHome: false, bring: "m1", pick: "grandma" },
      { weekday: 5, atHome: true, bring: null, pick: null },
    ],
    medicines: [
      { id: "para", name: "Paracetamol", intervalHours: 6 },
      { id: "ibu", name: "Ibuprofen", intervalHours: 8 },
    ],
    doses: [{ id: "d1", medicineId: "para", amount: "120 mg", at: ago(200), by: "m2" }],
    temperatures: [{ id: "tp1", celsius: 38.1, at: ago(205) }],
    appointments: [
      { id: "a1", title: "Consultatiebureau", at: at(2, 9, 15), place: "CJG Leidsche Rijn" },
      { id: "a2", title: "Oppas opa en oma", at: at(7, 18, 0), place: null },
    ],
    routine: [
      { id: "rt1", time: "09:30", label: "Slaapje" },
      { id: "rt2", time: "12:00", label: "Lunch" },
      { id: "rt3", time: "13:00", label: "Slaapje" },
      { id: "rt4", time: "17:30", label: "Avondeten" },
      { id: "rt5", time: "19:00", label: "Naar bed" },
    ],
    milestones: [
      { id: "ms1", date: addDays(today, -9), text: "Eerste stapjes los van de bank" },
      { id: "ms2", date: addDays(today, -23), text: "Zegt \"pa\" en \"ma\"" },
    ],
    sizes: [
      { id: "z1", label: "Kleding", size: "86", note: "92 ligt al in de kast" },
      { id: "z2", label: "Schoenen", size: "21", note: null },
      { id: "z3", label: "Luiers", size: "4", note: null },
      { id: "z4", label: "Pyjama", size: "86/92", note: null },
    ],
    stock: [
      { id: "st1", name: "Luiers maat 4", level: "low" },
      { id: "st2", name: "Billendoekjes", level: "half" },
      { id: "st3", name: "Knijpfruit", level: "full" },
      { id: "st4", name: "Zonnebrand factor 50", level: "full" },
    ],
    growth: [
      { id: "g1", date: addDays(today, -68), weightGrams: 9150, lengthCm: 74.5 },
      { id: "g2", date: addDays(today, -12), weightGrams: 9840, lengthCm: 77 },
    ],
    foods: [
      { id: "f1", name: "Avocado", date: addDays(today, -6), verdict: "likes" },
      { id: "f2", name: "Broccoli", date: addDays(today, -4), verdict: "dislikes" },
      { id: "f3", name: "Hummus", date: addDays(today, -1), verdict: "unsure" },
    ],
    recipes: [
      { id: "rc1", name: "Pompoenpasta met salie", ingredients: ["Flespompoen", "Penne", "Salie", "Parmezaan", "Ui"] },
      { id: "rc2", name: "Ovenschotel met zalm", ingredients: ["Zalmfilet", "Krieltjes", "Broccoli", "Crème fraîche"] },
      { id: "rc3", name: "Linzensoep", ingredients: ["Rode linzen", "Wortel", "Kokosmelk", "Bouillon"] },
      { id: "rc4", name: "Wraps met kip", ingredients: ["Wraps", "Kipfilet", "Avocado", "Sla", "Tomaat"] },
    ],
    mealPlan: [
      { date: today, recipeId: "rc1", cookId: "m1" },
      { date: addDays(today, 1), recipeId: "rc2", cookId: "m2" },
      { date: addDays(today, 2), recipeId: "rc3", cookId: "m1" },
      { date: addDays(today, 3), recipeId: "rc4", cookId: "m2" },
    ],
    shopping: [
      { id: "s1", name: "Flespompoen", checked: false, source: "recipe" },
      { id: "s2", name: "Salie", checked: false, source: "recipe" },
      { id: "s3", name: "Penne", checked: true, source: "recipe" },
      { id: "s4", name: "Luiers maat 4", checked: false, source: "stock" },
      { id: "s5", name: "Melk", checked: false, source: "manual" },
      { id: "s6", name: "Plexiglas bovenlicht", checked: false, source: "project" },
      { id: "s7", name: "Koffiebonen", checked: false, source: "manual" },
    ],
    events: [
      { id: "e1", title: "Verjaardag opa", start: at(0, 15, 30), allDay: false },
      { id: "e2", title: "Consultatiebureau", start: at(2, 9, 15), allDay: false },
      { id: "e3", title: "Etentje met vrienden", start: at(5, 19, 0), allDay: false },
      { id: "e4", title: "Afvalkalender: papier", start: at(3, 0, 0), allDay: true },
    ],
  };
}
