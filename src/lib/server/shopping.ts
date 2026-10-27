import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shoppingItems } from "@/db/schema";
import { scope, type HouseholdContext } from "./household";

/** Names of the shopping items that are "in huis" for the caller's household, in list order. */
export async function inHouseNames(ctx: HouseholdContext): Promise<string[]> {
  const rows = await db
    .select({ name: shoppingItems.name })
    .from(shoppingItems)
    .where(scope(ctx).where(shoppingItems, eq(shoppingItems.checked, true)))
    .orderBy(shoppingItems.position);
  return rows.map((r) => r.name);
}
