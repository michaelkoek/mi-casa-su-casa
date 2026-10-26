import "server-only";

/*
 * Local development only (`next dev`): every login code is DEV_LOGIN_CODE and the
 * login screen lists the members for one-tap sign-in. `next build` sets
 * NODE_ENV=production, so this is never active on Vercel (Production or Preview).
 */
export const devLogin = process.env.NODE_ENV === "development";

export const DEV_LOGIN_CODE = "000000";
