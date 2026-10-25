"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createSeed } from "./seed";
import type { HouseholdState } from "./types";

/**
 * Prototype data layer: one household kept in localStorage on this device.
 * Every screen talks to it through `useHousehold()` with pure updaters, so
 * swapping it for server actions on Neon in phase 1 touches only this file.
 */

const STORAGE_KEY = "mcsc:household:v1";

type Updater = (state: HouseholdState) => HouseholdState;

type HouseholdContext = {
  state: HouseholdState;
  ready: boolean;
  update: (fn: Updater) => HouseholdState;
  replace: (next: HouseholdState) => void;
  reset: () => void;
  /** Latest state outside render (for undo snapshots). */
  snapshot: () => HouseholdState;
};

const Ctx = createContext<HouseholdContext | null>(null);

function load(): HouseholdState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HouseholdState;
    if (parsed.version !== 1) return null;
    // Fields added later in the prototype fall back to demo data.
    return { ...createSeed(), ...parsed };
  } catch {
    return null;
  }
}

function save(state: HouseholdState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the session keeps working in memory */
  }
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  // Deterministic placeholder for the server render; real data loads in the effect below.
  const [state, setState] = useState<HouseholdState>(() => createSeed(new Date(0)));
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    const initial = load() ?? createSeed(new Date());
    stateRef.current = initial;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage once on the client
    setState(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    stateRef.current = state;
    if (ready) save(state);
  }, [state, ready]);

  // Other tabs or windows of the app stay in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = load();
      if (next) setState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // PWA app badge: number of open signals on the home-screen icon.
  useEffect(() => {
    if (!ready) return;
    const open = state.signals.filter((s) => s.openedAt).length;
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (open > 0) nav.setAppBadge?.(open).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [state.signals, ready]);

  const update = useCallback((fn: Updater) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  const replace = useCallback((next: HouseholdState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const reset = useCallback(() => replace(createSeed()), [replace]);
  const snapshot = useCallback(() => stateRef.current, []);

  const value = useMemo(
    () => ({ state, ready, update, replace, reset, snapshot }),
    [state, ready, update, replace, reset, snapshot],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHousehold() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHousehold must be used inside HouseholdProvider");
  return ctx;
}

/** Current time, refreshed every 30 seconds so "volgende dosis" and "12 min geleden" stay true. */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date(Date.now()));
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useMemberName() {
  const { state } = useHousehold();
  return useCallback(
    (id: string | null) => state.members.find((m) => m.id === id)?.name ?? "",
    [state.members],
  );
}
