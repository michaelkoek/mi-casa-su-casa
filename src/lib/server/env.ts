import "server-only";
import { z } from "zod";

/*
 * Server environment, validated lazily on first use. The base set is needed
 * everywhere; mail and push values are checked where they are used, so a build
 * does not need them.
 */

const base = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().optional(),
  VERCEL_URL: z.string().optional(),
});

const mail = z.object({
  GMAIL_USER: z.string().email(),
  GMAIL_APP_PASSWORD: z.string().min(1),
});

const push = z.object({
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().min(1),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
});

function parse<T extends z.ZodType>(schema: T, label: string): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`Missing or invalid environment variables (${label}): ${names.join(", ")}`);
  }
  return result.data;
}

let cached: z.infer<typeof base> | undefined;

/** Core variables: database and auth secret. */
export function env() {
  return (cached ??= parse(base, "core"));
}

/** Absolute base URL of the app. */
export function baseUrl(): string {
  const e = env();
  if (e.BETTER_AUTH_URL) return e.BETTER_AUTH_URL;
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Gmail credentials, or null when the app password is not set (allowed outside production). */
export function mailEnv() {
  if (!process.env.GMAIL_APP_PASSWORD && process.env.NODE_ENV !== "production") return null;
  return parse(mail, "mail");
}

const ai = z.object({ ANTHROPIC_API_KEY: z.string().min(1) });

/** Anthropic key for "Verras me", or null when not set (the feature then reports "unavailable"). */
export function aiEnv(): { ANTHROPIC_API_KEY: string } | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return parse(ai, "ai");
}

export function pushEnv() {
  return parse(push, "push");
}
