import { NextResponse, type NextRequest } from "next/server";
import { isCronRequest } from "@/lib/server/cron";
import { jobContext } from "@/lib/server/household";
import { householdsWithHue, maintainHue } from "@/lib/server/lights/connections";

/* Daily Hue token upkeep (vercel.json). */

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = { households: 0, refreshed: 0, expired: 0, failed: 0 };
  for (const householdId of await householdsWithHue()) {
    summary.households++;
    try {
      const result = await maintainHue(jobContext(householdId));
      if (result === "refreshed") summary.refreshed++;
      if (result === "expired") summary.expired++;
    } catch (err) {
      summary.failed++;
      console.error("lights cron failed", err instanceof Error ? err.name : "unknown");
    }
  }
  return NextResponse.json(summary);
}
