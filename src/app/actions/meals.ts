"use server";

import { buildMealPrompt, MEAL_IDEAS_SYSTEM, parseMealIdeas, type MealIdea } from "@/lib/meal-ideas";
import { aiEnv } from "@/lib/server/env";
import { requireHouseholdForAction } from "@/lib/server/household";
import { inHouseNames } from "@/lib/server/shopping";

export async function suggestMealsAI(): Promise<
  { ok: true; ideas: MealIdea[] } | { ok: false; error: "unauthorized" | "unavailable" | "failed" }
> {
  const ctx = await requireHouseholdForAction();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const e = aiEnv();
  if (!e) return { ok: false, error: "unavailable" };
  try {
    const names = await inHouseNames(ctx);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": e.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 1024,
        system: MEAL_IDEAS_SYSTEM,
        messages: [{ role: "user", content: buildMealPrompt(names) }],
      }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("suggestMealsAI failed", res.status);
      return { ok: false, error: "failed" };
    }
    const json = (await res.json()) as { content?: { type?: string; text?: string }[] };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("");
    const ideas = parseMealIdeas(text);
    if (!ideas) {
      console.error("suggestMealsAI failed", "unparsable");
      return { ok: false, error: "failed" };
    }
    return { ok: true, ideas };
  } catch (err) {
    console.error("suggestMealsAI failed", err instanceof Error ? err.name : "error");
    return { ok: false, error: "failed" };
  }
}
