import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BankApiError, createSession } from "@/lib/server/bank/enable-banking";
import { importConnection, saveSession, takeAuthState } from "@/lib/server/bank/import";
import { getHouseholdContext } from "@/lib/server/household";

/*
 * The bank sends the user back here with ?code&state (or ?error&state). The state must be
 * one this household created in the last minutes; the code becomes a stored session.
 */

export const maxDuration = 120;

const back = (req: NextRequest, result: "linked" | "cancelled" | "failed") =>
  NextResponse.redirect(new URL(`/geld?bank=${result}`, req.url), 303);

export async function GET(req: NextRequest) {
  const ctx = await getHouseholdContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", req.url), 303);

  const params = req.nextUrl.searchParams;
  const state = z.uuid().safeParse(params.get("state"));
  if (!state.success) return back(req, "failed");
  const aspsp = await takeAuthState(ctx, state.data);
  if (!aspsp) return back(req, "failed");

  const code = params.get("code");
  if (!code || params.get("error")) return back(req, "cancelled");

  try {
    const session = await createSession(code);
    const connectionId = await saveSession(ctx, aspsp, session);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = req.headers.get("user-agent");
    await importConnection(ctx, connectionId, {
      psu: ip && userAgent ? { ip, userAgent: userAgent.slice(0, 300) } : undefined,
    });
    return back(req, "linked");
  } catch (err) {
    console.error("bank callback failed", err instanceof BankApiError ? err.message : err instanceof Error ? err.name : "unknown");
    return back(req, "failed");
  }
}
