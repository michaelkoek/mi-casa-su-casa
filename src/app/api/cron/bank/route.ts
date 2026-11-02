import { NextResponse, type NextRequest } from "next/server";
import { householdsWithBank, importHousehold } from "@/lib/server/bank/import";
import { isCronRequest } from "@/lib/server/cron";
import { jobContext } from "@/lib/server/household";

/* Daily bank import (vercel.json). */

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = { households: 0, imported: 0, expired: 0, failed: 0 };
  for (const householdId of await householdsWithBank()) {
    summary.households++;
    try {
      for (const r of await importHousehold(jobContext(householdId))) {
        summary.imported += r.imported;
        if (r.status === "expired") summary.expired++;
        if (r.status === "error") summary.failed++;
      }
    } catch (err) {
      summary.failed++;
      console.error("bank cron failed", err instanceof Error ? err.name : "unknown");
    }
  }
  return NextResponse.json(summary);
}
