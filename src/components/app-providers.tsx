"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { HouseholdProvider } from "@/lib/store";
import { QuickAdd } from "./quick-add";
import { TabBar } from "./tab-bar";
import { UIProvider, useUI, type SheetKind } from "./ui-provider";

const SHORTCUTS: SheetKind[] = ["expense", "task", "project", "dose"];

/** Opens a quick form when the app is launched from a home-screen shortcut (?add=expense). */
function ShortcutHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const { openSheet } = useUI();
  useEffect(() => {
    const add = params.get("add") as SheetKind | null;
    if (add && SHORTCUTS.includes(add)) {
      openSheet(add);
      router.replace(window.location.pathname);
    }
  }, [params, openSheet, router]);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <HouseholdProvider>
      <UIProvider>
        {children}
        <TabBar />
        <QuickAdd />
        <Suspense fallback={null}>
          <ShortcutHandler />
        </Suspense>
      </UIProvider>
    </HouseholdProvider>
  );
}
