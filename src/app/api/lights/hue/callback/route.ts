import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getHouseholdContext, jobContext } from "@/lib/server/household";
import { connectHue, takeHueAuthStateUnscoped } from "@/lib/server/lights/connections";
import { HueError } from "@/lib/server/lights/hue";

/*
 * Hue sends the user back here with ?code&state. As with the bank link, iOS may open this in Safari
 * without the PWA's session, so the household comes from the one-time state, not from a session.
 */

type Outcome = "linked" | "cancelled" | "failed";

export async function GET(req: NextRequest) {
  const session = await getHouseholdContext();
  const back = (result: Outcome) =>
    NextResponse.redirect(new URL(session ? `/huis/lampen?hue=${result}` : `/lampen-klaar?result=${result}`, req.url), 303);

  const params = req.nextUrl.searchParams;
  const state = z.uuid().safeParse(params.get("state"));
  if (!state.success) return back("failed");
  const householdId = await takeHueAuthStateUnscoped(state.data);
  if (!householdId) return back("failed");
  // A session of another household than the one that started the link: refuse (the state is spent).
  if (session && session.householdId !== householdId) return back("failed");

  const code = params.get("code");
  if (!code || params.get("error")) return back("cancelled");

  try {
    await connectHue(jobContext(householdId), code);
    return back("linked");
  } catch (err) {
    console.error("hue callback failed", err instanceof HueError ? err.message : err instanceof Error ? err.name : "unknown");
    return back("failed");
  }
}
