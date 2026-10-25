"use server";

import { loadHouseholdState } from "@/lib/server/household-state";
import { requireHouseholdForAction } from "@/lib/server/household";
import { writeChangeset } from "@/lib/server/apply-changes";
import { parseChangeset } from "@/lib/sync/schema";
import type { HouseholdState } from "@/lib/types";

export async function pullHousehold(): Promise<{ ok: true; state: HouseholdState } | { ok: false; error: "unauthorized" }> {
  const ctx = await requireHouseholdForAction();
  if (!ctx) return { ok: false, error: "unauthorized" };
  return { ok: true, state: await loadHouseholdState(ctx) };
}

export async function applyChanges(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: "unauthorized" | "invalid" | "conflict" | "server" }> {
  const ctx = await requireHouseholdForAction();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const parsed = parseChangeset(input);
  if (!parsed.ok) return { ok: false, error: "invalid" };
  return writeChangeset(ctx, parsed.value);
}
