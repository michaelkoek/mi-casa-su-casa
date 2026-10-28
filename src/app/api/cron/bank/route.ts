import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { householdsWithBank, importHousehold } from "@/lib/server/bank/import";
import { cronEnv } from "@/lib/server/env";
import { jobContext } from "@/lib/server/household";

/* Daily bank import (vercel.json). Vercel Cron sends "Authorization: Bearer $CRON_SECRET". */

export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  // Read the request first: that keeps this handler out of build-time prerendering.
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${cronEnv().CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
