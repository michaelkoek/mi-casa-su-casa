import { z } from "zod";
import { cleanNames } from "./logic";

/* Pure helpers for the "Verras me" meal ideas: prompt and output parsing. No env, no network. */

export type MealIdea = { title: string; ingredients: string[] };

export const MEAL_IDEAS_SYSTEM =
  "Je bent een praktische kok voor een Nederlands gezin met een jong kind. Antwoord alleen met JSON, zonder uitleg en zonder markdown.";

const TAIL =
  ' Kies gangbare, eenvoudige gerechten. Geef per maaltijd een korte titel (maximaal 60 tekens) en de belangrijkste ingrediënten (maximaal 10, Nederlandse namen, zonder hoeveelheden). Antwoord precies in dit formaat: [{"title": "...", "ingredients": ["..."]}]';

/** Dutch user prompt from the items that are in huis. */
export function buildMealPrompt(items: string[]): string {
  const names = cleanNames(items, 60);
  const head =
    names.length > 0
      ? `Stel 3 avondmaaltijden voor met vooral deze ingrediënten die we in huis hebben: ${names.join(", ")}.`
      : "We hebben niets bijzonders in huis. Stel 3 eenvoudige avondmaaltijden voor.";
  return head + TAIL;
}

const ideasSchema = z
  .array(
    z.object({
      title: z.string().trim().min(1).max(100),
      ingredients: z.array(z.string()).max(20),
    }),
  )
  .min(1);

/** Parses model text into at most 3 ideas, or null on any failure. */
export function parseMealIdeas(text: string): MealIdea[] | null {
  const stripped = text.replace(/```[a-zA-Z]*/g, "");
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
  const r = ideasSchema.safeParse(json);
  if (!r.success) return null;
  return r.data.slice(0, 3).map((i) => ({ title: i.title, ingredients: cleanNames(i.ingredients, 20) }));
}
