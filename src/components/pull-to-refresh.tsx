"use client";

import { ArrowClockwise, Check, WarningCircle } from "@phosphor-icons/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { refreshBank } from "@/app/actions/bank";
import { MIN_VISIBLE_MS, PULL_THRESHOLD, progress, pullPhase, resist, shouldStart, type PullPhase } from "@/lib/pull-refresh";
import { useHousehold } from "@/lib/store";
import { useUI } from "./ui-provider";

const CHIP = 44;
const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SPRING = { type: "spring", stiffness: 380, damping: 38 } as const;
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

type Shown = PullPhase | "done" | "failed";

/**
 * Pull down at the top of any page to re-fetch everything. A round chip slides over the content
 * (the content itself never moves, so fixed sheets and the tab bar stay put).
 */
export function PullToRefresh() {
  const t = useTranslations("pullRefresh");
  const bank = useTranslations("bank");
  const { refresh, sync } = useHousehold();
  const { toast } = useUI();
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const dist = useMotionValue(0);
  const y = useTransform(dist, (d) => d - CHIP);
  const opacity = useTransform(dist, (d) => progress(d));
  const ringLength = useTransform(dist, (d) => progress(d));
  const rotate = useTransform(dist, (d) => (reduce ? 0 : progress(d) * 270));

  const [phase, setPhase] = useState<Shown>("idle");
  const [pop, setPop] = useState(0);
  const [settled, setSettled] = useState<{ bankFailed: boolean } | null>(null);
  const phaseRef = useRef<Shown>("idle");
  const pathRef = useRef(pathname);
  const timers = useRef<number[]>([]);
  const alive = useRef(true);

  const show = useCallback((next: Shown) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    alive.current = true;
    const pending = timers.current;
    return () => {
      alive.current = false;
      pending.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const doRefresh = useCallback(async () => {
    show("refreshing");
    let bankFailed = false;
    const work = (async () => {
      if (pathRef.current.startsWith("/geld")) {
        try {
          const res = await refreshBank();
          if (!res.ok && res.error === "failed") bankFailed = true;
          else if (res.ok && res.expired) toast(bank("refreshExpired"));
        } catch {
          bankFailed = true;
        }
      }
      await refresh();
    })();
    await Promise.all([work, wait(MIN_VISIBLE_MS)]);
    if (alive.current) setSettled({ bankFailed });
  }, [bank, refresh, show, toast]);

  // The render after refresh() already holds its setSync calls, so `sync` is current here.
  useEffect(() => {
    if (!settled) return;
    const failed = settled.bankFailed || sync.offline || sync.serverDown;
    /* eslint-disable react-hooks/set-state-in-effect -- settle once the refreshed sync state has rendered */
    setSettled(null);
    show(failed ? "failed" : "done");
    /* eslint-enable react-hooks/set-state-in-effect */
    if (failed) toast(t("failed"));
    const later = (fn: () => void, ms: number) => {
      timers.current.push(window.setTimeout(() => alive.current && fn(), ms));
    };
    // Icon morph (200 ms), hold, then slide away.
    later(() => {
      void animate(dist, 0, { duration: 0.26, ease: [0.16, 1, 0.3, 1] }).then(() => {
        if (alive.current) show("idle");
      });
    }, 200 + 250);
  }, [settled, sync, show, toast, t, dist]);

  useEffect(() => {
    let tracking = false;
    let decision: "wait" | "pull" | "cancel" = "cancel";
    let startX = 0;
    let startY = 0;
    let lastDist = 0;

    const reset = (animateBack: boolean) => {
      tracking = false;
      decision = "cancel";
      if (phaseRef.current === "pulling" || phaseRef.current === "armed") show("idle");
      if (animateBack) void animate(dist, 0, SPRING);
    };

    const onStart = (e: TouchEvent) => {
      if (phaseRef.current !== "idle" || e.touches.length !== 1 || window.scrollY > 0) return;
      if (document.querySelector('[role="dialog"]')) return;
      tracking = true;
      decision = "wait";
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastDist = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      if (e.touches.length !== 1) return reset(decision === "pull");
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (decision === "wait") {
        decision = shouldStart(window.scrollY, dx, dy);
        if (decision === "cancel") {
          tracking = false;
          return;
        }
      }
      if (decision !== "pull") return;
      if (e.cancelable) e.preventDefault();
      const d = resist(dy);
      dist.set(d);
      const next = pullPhase(d, false);
      if (next === "armed" && phaseRef.current === "pulling") {
        setPop((n) => n + 1);
        navigator.vibrate?.(10);
      }
      if (next !== phaseRef.current && (next === "pulling" || next === "armed" || next === "idle")) show(next);
      lastDist = d;
    };

    const onEnd = () => {
      if (!tracking) return;
      const pulled = decision === "pull";
      tracking = false;
      decision = "cancel";
      if (pulled && pullPhase(lastDist, true) === "refreshing") {
        void animate(dist, PULL_THRESHOLD, SPRING);
        void doRefresh();
      } else {
        if (pulled) show("idle");
        void animate(dist, 0, SPRING);
      }
    };

    const onCancel = () => {
      if (!tracking) return;
      reset(true);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, [dist, doRefresh, show]);

  const label =
    phase === "pulling" ? t("pull")
    : phase === "armed" ? t("release")
    : phase === "refreshing" ? t("busy")
    : phase === "done" ? t("done")
    : phase === "failed" ? t("failed")
    : "";
  const spinning = phase === "refreshing" && !reduce;
  const finished = phase === "done" || phase === "failed";

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-40 flex justify-center">
        <motion.div
          key={pop}
          style={{ y, opacity, width: CHIP, height: CHIP }}
          animate={pop > 0 && !reduce ? { scale: [1, 1.12, 1] } : undefined}
          transition={{ duration: 0.24 }}
          className="grid place-items-center rounded-full bg-surface shadow-card"
        >
          <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
            <motion.circle
              cx="22" cy="22" r={RADIUS} fill="none" strokeWidth="2.5" strokeLinecap="round"
              stroke="var(--accent)"
              style={{ pathLength: reduce || finished || phase === "refreshing" ? 1 : ringLength }}
              opacity={spinning ? 0.2 : 1}
            />
          </svg>
          {spinning && (
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, ease: "linear", duration: 0.9 }}
            >
              <svg viewBox="0 0 44 44" className="-rotate-90">
                <circle
                  cx="22" cy="22" r={RADIUS} fill="none" strokeWidth="2.5" strokeLinecap="round" stroke="var(--accent)"
                  strokeDasharray={`${CIRCUMFERENCE * 0.3} ${CIRCUMFERENCE}`}
                />
              </svg>
            </motion.div>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={phase === "done" ? "done" : phase === "failed" ? "failed" : "arrow"}
              initial={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
              transition={{ duration: 0.2 }}
              className="relative grid place-items-center"
            >
              {phase === "done" ? <Check size={20} />
                : phase === "failed" ? <WarningCircle size={20} className="text-bad" />
                : <motion.span style={{ rotate }} className="grid place-items-center"><ArrowClockwise size={20} /></motion.span>}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      </div>
      <p className="sr-only" aria-live="polite">{label}</p>
    </>
  );
}
