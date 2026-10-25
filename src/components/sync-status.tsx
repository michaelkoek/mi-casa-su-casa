"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useHousehold } from "@/lib/store";
import { useUI } from "./ui-provider";

/** Offline / server-down pill above the tab bar, and a toast when a change was rejected by the server. */
export function SyncStatus() {
  const t = useTranslations("sync");
  const { sync, ready } = useHousehold();
  const { toast } = useUI();
  const lastFailed = useRef<number | null>(null);

  useEffect(() => {
    if (sync.failedAt && sync.failedAt !== lastFailed.current) {
      lastFailed.current = sync.failedAt;
      toast(t("failed"));
    }
  }, [sync.failedAt, toast, t]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+160px)] z-30 mx-auto flex max-w-md justify-center px-4">
      <AnimatePresence>
        {ready && (sync.offline || sync.serverDown) && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-bg shadow-card"
          >
            {sync.offline ? t("offline") : t("serverDown")}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
