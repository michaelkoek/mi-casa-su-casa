"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireHouseholdForAction } from "@/lib/server/household";
import { listMembers, removeSubscription, saveSubscription, sendPushToMembers } from "@/lib/server/push";

const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function savePushSubscription(input: unknown): Promise<{ ok: boolean }> {
  const ctx = await requireHouseholdForAction();
  if (!ctx) return { ok: false };
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { endpoint, keys } = parsed.data;
  const userAgent = ((await headers()).get("user-agent") ?? "").slice(0, 300) || null;
  try {
    await saveSubscription(ctx, { endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent });
    return { ok: true };
  } catch {
    console.error("savePushSubscription failed");
    return { ok: false };
  }
}

export async function deletePushSubscription(input: unknown): Promise<{ ok: boolean }> {
  const ctx = await requireHouseholdForAction();
  if (!ctx) return { ok: false };
  const parsed = z.object({ endpoint: z.string().min(1).max(1000) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  await removeSubscription(ctx, parsed.data.endpoint);
  return { ok: true };
}

export async function sendTestPush(): Promise<
  { ok: true; sent: number } | { ok: false; error: "unauthorized" | "no-subscriptions" | "failed" }
> {
  const ctx = await requireHouseholdForAction();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const t = await getTranslations("push");
  try {
    const r = await sendPushToMembers(ctx, [ctx.memberId], {
      title: t("testTitle"),
      body: t("testBody"),
      url: "/meer/instellingen",
      tag: "test",
    });
    if (r.sent > 0) return { ok: true, sent: r.sent };
    return { ok: false, error: r.failed > 0 ? "failed" : "no-subscriptions" };
  } catch {
    console.error("sendTestPush failed");
    return { ok: false, error: "failed" };
  }
}

export async function notifyShoppingTrip(): Promise<
  { ok: true; sent: number } | { ok: false; error: "unauthorized" | "failed" }
> {
  const ctx = await requireHouseholdForAction();
  if (!ctx) return { ok: false, error: "unauthorized" };
  try {
    const rows = await listMembers(ctx);
    const name = rows.find((m) => m.id === ctx.memberId)?.name ?? "";
    const others = rows.filter((m) => m.id !== ctx.memberId).map((m) => m.id);
    if (others.length === 0) return { ok: true, sent: 0 };
    const t = await getTranslations("shopping.push");
    const r = await sendPushToMembers(ctx, others, {
      title: t("title", { name }),
      body: t("body"),
      url: "/meer/boodschappen",
      tag: "shopping-trip",
    });
    return { ok: true, sent: r.sent };
  } catch {
    console.error("notifyShoppingTrip failed");
    return { ok: false, error: "failed" };
  }
}
