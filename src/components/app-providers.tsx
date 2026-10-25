"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { HouseholdProvider } from "@/lib/store";
import type { HouseholdState } from "@/lib/types";
import { QuickAdd } from "./quick-add";
import { SyncStatus } from "./sync-status";
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

export function AppProviders({
  initialState,
  householdId,
  account,
  children,
}: {
  initialState: HouseholdState;
  householdId: string;
  account: { email: string };
  children: ReactNode;
}) {
  return (
    <HouseholdProvider initialState={initialState} householdId={householdId} account={account}>
      <UIProvider>
        {children}
        <SyncStatus />
        <TabBar />
        <QuickAdd />
        <Suspense fallback={null}>
          <ShortcutHandler />
        </Suspense>
      </UIProvider>
    </HouseholdProvider>
  );
}
