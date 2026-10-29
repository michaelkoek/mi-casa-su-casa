import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { callbackOutcome, type CallbackOutcome } from "@/lib/bank-callback";
import { BankApiError, createSession } from "@/lib/server/bank/enable-banking";
import { importConnection, saveSession, takeAuthStateUnscoped } from "@/lib/server/bank/import";
import { getHouseholdContext, jobContext } from "@/lib/server/household";

/*
 * The bank sends the user back here with ?code&state (or ?error&state). iOS may open this in
 * Safari, without the PWA's session cookie, so the household comes from the one-time state,
 * not from a session. With a session the user lands on /geld, without on the public /bank-klaar.
 */

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const session = await getHouseholdContext();
  const back = (result: CallbackOutcome) =>
    NextResponse.redirect(new URL(session ? `/geld?bank=${result}` : `/bank-klaar?result=${result}`, req.url), 303);

  const params = req.nextUrl.searchParams;
  const state = z.uuid().safeParse(params.get("state"));
  if (!state.success) return back("failed");
  const auth = await takeAuthStateUnscoped(state.data);
  if (!auth) return back("failed");
  // A session of another household than the one that started the link: refuse (the state is spent).
  if (session && session.householdId !== auth.householdId) return back("failed");

  const ctx = jobContext(auth.householdId);
  const aspsp = { name: auth.name, country: auth.country };

  const code = params.get("code");
  if (!code || params.get("error")) return back("cancelled");

  try {
    const eb = await createSession(code);
    const connectionId = await saveSession(ctx, aspsp, eb);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = req.headers.get("user-agent");
    const result = await importConnection(ctx, connectionId, {
      psu: ip && userAgent ? { ip, userAgent: userAgent.slice(0, 300) } : undefined,
    });
    return back(callbackOutcome(result));
  } catch (err) {
    console.error("bank callback failed", err instanceof BankApiError ? err.message : err instanceof Error ? err.name : "unknown");
    return back("failed");
  }
}
