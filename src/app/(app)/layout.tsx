import { Suspense, type ReactNode } from "react";
import { AppProviders } from "@/components/app-providers";
import { ScreenSkeleton } from "@/components/screen";
import { requireHousehold } from "@/lib/server/household";
import { loadHouseholdState } from "@/lib/server/household-state";

/** Reads the session and the household at request time, so it streams in behind Suspense. */
async function HouseholdGate({ children }: { children: ReactNode }) {
  const ctx = await requireHousehold();
  const initialState = await loadHouseholdState(ctx);
  return (
    <AppProviders initialState={initialState} householdId={ctx.householdId} account={{ email: ctx.email }}>
      {children}
    </AppProviders>
  );
}

function AppSkeleton() {
  return (
    <div className="screen-pad mx-auto w-full max-w-md">
      <ScreenSkeleton />
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <HouseholdGate>{children}</HouseholdGate>
    </Suspense>
  );
}
