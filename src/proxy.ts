import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/** Optimistic check only (cookie present). Real authorisation happens in the data layer. */
export function proxy(req: NextRequest) {
  if (!getSessionCookie(req)) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|api/cron|_next/static|_next/image|serwist|~offline|icons|brand|manifest.webmanifest|favicon.ico|icon.png|apple-icon.png).*)",
  ],
};
