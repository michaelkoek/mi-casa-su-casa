"use client";

import { ViewTransition, type ReactNode } from "react";
import { useHousehold } from "@/lib/store";

/** Wraps every page: directional slide on tab changes, skeleton until local data is loaded. */
export function Screen({ children }: { children: ReactNode }) {
  const { ready } = useHousehold();
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <main className="screen-pad mx-auto w-full max-w-md">{ready ? children : <ScreenSkeleton />}</main>
    </ViewTransition>
  );
}

export function ScreenSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <div className="skeleton h-10 w-40" />
      <div className="skeleton h-40" />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="skeleton h-56" />
        <div className="skeleton h-44" />
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3">
      <div>
        <p className="text-[13px] text-ink-3">{eyebrow}</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mx-0.5 mb-2.5 mt-7 flex items-baseline justify-between text-[13px] font-semibold text-ink-3">
      <span>{children}</span>
      {aside && <span className="font-medium">{aside}</span>}
    </div>
  );
}
