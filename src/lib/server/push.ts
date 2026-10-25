import "server-only";
import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { pushEnv } from "./env";
import { scope, type HouseholdContext } from "./household";

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured = false;

/** Sends a push to every device of the given members in the caller's household. */
export async function sendPushToMembers(
  ctx: HouseholdContext,
  memberIds: string[],
  payload: PushPayload,
): Promise<{ sent: number; removed: number; failed: number }> {
  const result = { sent: 0, removed: 0, failed: 0 };
  if (memberIds.length === 0) return result;
  if (!configured) {
    const e = pushEnv();
    webpush.setVapidDetails(e.VAPID_SUBJECT, e.NEXT_PUBLIC_VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY);
    configured = true;
  }
  const s = scope(ctx);
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(s.where(pushSubscriptions, inArray(pushSubscriptions.memberId, memberIds)));

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 3600 },
        );
        await db
          .update(pushSubscriptions)
          .set({ lastSuccessAt: new Date() })
          .where(s.where(pushSubscriptions, eq(pushSubscriptions.id, sub.id)));
        result.sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db
            .delete(pushSubscriptions)
            .where(s.where(pushSubscriptions, eq(pushSubscriptions.id, sub.id)));
          result.removed++;
        } else {
          result.failed++;
        }
      }
    }),
  );
  return result;
}

export type SubscriptionInput = { endpoint: string; p256dh: string; auth: string; userAgent: string | null };

/** Upserts on the endpoint: the same browser logging in elsewhere moves the row. */
export async function saveSubscription(ctx: HouseholdContext, input: SubscriptionInput): Promise<void> {
  const set = {
    householdId: ctx.householdId,
    memberId: ctx.memberId,
    userId: ctx.userId,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: input.userAgent,
    updatedAt: new Date(),
  };
  await db
    .insert(pushSubscriptions)
    .values({ ...set, endpoint: input.endpoint })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set });
}

/** Removes one of the caller's own subscriptions. */
export async function removeSubscription(ctx: HouseholdContext, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(
      scope(ctx).where(pushSubscriptions, eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.memberId, ctx.memberId)),
    );
}
