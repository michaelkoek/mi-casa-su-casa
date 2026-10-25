"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions/push";
import { urlBase64ToUint8Array } from "@/lib/push-keys";
import { SoftButton } from "./form";
import { useUI } from "./ui-provider";

type PushState = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function detect(): Exclude<PushState, "loading" | "off" | "on" | "denied"> | null {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  if (ios && !standalone) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return null;
}

/** The Meldingen section in Settings: turn push on or off for this device and send a test. */
export function PushSettings() {
  const t = useTranslations("push");
  const { toast } = useUI();
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const blocked = detect();
    if (blocked) return setState(blocked);
    if (Notification.permission === "denied") return setState("denied");
    const sub = await currentSubscription();
    if (sub) {
      // Idempotent re-save, so a moved or refreshed subscription stays registered.
      void savePushSubscription(sub.toJSON()).catch(() => {});
      return setState("on");
    }
    setState("off");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detect browser support once on the client
    void refresh();
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      // requestPermission must be called from the click handler (iOS).
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
      });
      const saved = await savePushSubscription(sub.toJSON());
      if (!saved.ok) throw new Error("save failed");
      setState("on");
    } catch {
      toast(t("enableFailed"));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const res = await sendTestPush();
      toast(res.ok ? t("testSent") : res.error === "no-subscriptions" ? t("testNone") : t("testFailed"));
    } catch {
      toast(t("testFailed"));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await deletePushSubscription({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
      toast(t("disabled"));
    } catch {
      toast(t("enableFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return <div aria-hidden="true" className="skeleton h-12" />;

  const text =
    state === "unsupported" ? t("unsupported")
    : state === "needs-install" ? t("needsInstall")
    : state === "denied" ? t("denied")
    : state === "on" ? t("on")
    : t("disabled");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">{text}</p>
      {state === "off" && <SoftButton onClick={enable} disabled={busy}>{t("enable")}</SoftButton>}
      {state === "on" && (
        <div className="grid grid-cols-2 gap-2.5">
          <SoftButton onClick={test} disabled={busy}>{t("test")}</SoftButton>
          <SoftButton onClick={disable} disabled={busy}>{t("disable")}</SoftButton>
        </div>
      )}
    </div>
  );
}
