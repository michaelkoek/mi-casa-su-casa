import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { db } from "@/db";
import * as authTables from "@/db/auth-schema";
import { baseUrl, env } from "@/lib/server/env";
import { isMemberEmail } from "@/lib/server/household";
import { sendLoginCode } from "@/lib/server/mail";

const url = baseUrl();

export const auth = betterAuth({
  baseURL: url,
  secret: env().BETTER_AUTH_SECRET,
  trustedOrigins: [url],
  database: drizzleAdapter(db, { provider: "pg", schema: authTables, transaction: false }),
  emailAndPassword: { enabled: false },
  session: { expiresIn: 60 * 60 * 24 * 180, updateAge: 60 * 60 * 24 },
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/sign-in/email-otp": { window: 60, max: 10 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Only emails that exist in `members` may ever get a user row.
        before: async (user) => ((await isMemberEmail(user.email)) ? { data: user } : false),
      },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
      async sendVerificationOTP({ email, otp, type }) {
        // Same behaviour for unknown emails: no mail, no error.
        if (type !== "sign-in" || !(await isMemberEmail(email))) return;
        await sendLoginCode(email, otp);
      },
    }),
    nextCookies(),
  ],
});
