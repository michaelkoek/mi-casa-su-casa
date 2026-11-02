import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { cronEnv } from "./env";

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET". */
export function isCronRequest(req: NextRequest): boolean {
  // Read the request first: that keeps the handler out of build-time prerendering.
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  let secret: string;
  try {
    secret = cronEnv().CRON_SECRET;
  } catch {
    return false; // not configured: nobody may run it
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
