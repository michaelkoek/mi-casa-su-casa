"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useHousehold } from "@/lib/store";
import type { HouseholdState } from "@/lib/types";

export type SheetKind = "expense" | "task" | "project" | "dose" | "quick";

type Toast = { id: number; text: string; undo?: () => void };

type UIContext = {
  toast: (text: string, undo?: () => void) => void;
  /** Applies an update and offers "Ongedaan maken" that restores the state from before it. */
  act: (text: string, fn: (s: HouseholdState) => HouseholdState) => void;
  sheet: SheetKind | null;
  openSheet: (kind: SheetKind) => void;
  closeSheet: () => void;
};

const Ctx = createContext<UIContext | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const { update, replace, snapshot } = useHousehold();
  const [toastState, setToast] = useState<Toast | null>(null);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const timer = useRef<number | null>(null);

  const toast = useCallback((text: string, undo?: () => void) => {
    if (timer.current) window.clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, text, undo });
    timer.current = window.setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), 4500);
  }, []);

  const act = useCallback(
    (text: string, fn: (s: HouseholdState) => HouseholdState) => {
      const before = snapshot();
      update(fn);
      toast(text, () => replace(before));
    },
    [update, replace, toast, snapshot],
  );

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const value = useMemo(
    () => ({ toast, act, sheet, openSheet: (k: SheetKind) => setSheet(k), closeSheet: () => setSheet(null) }),
    [toast, act, sheet],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-40 mx-auto flex max-w-md justify-center px-4">
        <AnimatePresence>
          {toastState && (
            <motion.div
              key={toastState.id}
              role="status"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="pointer-events-auto flex min-h-14 w-full items-center justify-between gap-2 rounded-[18px] bg-ink py-1.5 pl-4 pr-1.5 text-sm text-bg shadow-card"
            >
              <span>{toastState.text}</span>
              {toastState.undo && (
                <button
                  type="button"
                  className="press h-11 rounded-xl px-3 font-semibold text-[#f6a46f]"
                  onClick={() => {
                    toastState.undo?.();
                    setToast(null);
                  }}
                >
                  {t("undo")}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUI must be used inside UIProvider");
  return ctx;
}
