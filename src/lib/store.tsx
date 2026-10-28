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
import { applyChanges, pullHousehold } from "@/app/actions/household";
import { hardNavigate } from "./navigate";
import type { Changeset } from "./sync/collections";
import { diffState, rebase } from "./sync/diff";
import type { HouseholdState } from "./types";

/**
 * Server-backed data layer. Screens call `update(updater)`; the change is applied
 * optimistically, turned into a row-level changeset, queued in localStorage and sent
 * to Neon through a server action. Other devices catch up through `pull`.
 */

type Updater = (state: HouseholdState) => HouseholdState;

/** `offline`: no network. `serverDown`: network works, but the server threw (database, deploy). */
type SyncInfo = { offline: boolean; serverDown: boolean; pending: number; failedAt: number | null };

type HouseholdContext = {
  state: HouseholdState;
  /** False on the server render and the first client render (prevents UTC vs Amsterdam hydration mismatch). */
  ready: boolean;
  update: (fn: Updater) => HouseholdState;
  /** Latest state outside render (for undo snapshots). */
  snapshot: () => HouseholdState;
  account: { email: string };
  sync: SyncInfo;
  /** Sends pending changes and pulls the server state now (e.g. after a bank import). */
  refresh: () => Promise<void>;
};

const Ctx = createContext<HouseholdContext | null>(null);

const queueKey = (householdId: string) => `mcsc:pending:${householdId}`;
const RELOAD_KEY = "mcsc:reloaded";
const POLL_MS = 30000;

function loadQueue(householdId: string): Changeset[] {
  try {
    const raw = window.localStorage.getItem(queueKey(householdId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Changeset[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(householdId: string, queue: Changeset[]) {
  try {
    if (queue.length === 0) window.localStorage.removeItem(queueKey(householdId));
    else window.localStorage.setItem(queueKey(householdId), JSON.stringify(queue));
  } catch {
    /* storage full or blocked: the queue keeps working in memory */
  }
}

export function HouseholdProvider({
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
  const [state, setState] = useState<HouseholdState>(initialState);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<SyncInfo>({ offline: false, serverDown: false, pending: 0, failedAt: null });
  const stateRef = useRef(state);
  const queueRef = useRef<Changeset[]>([]);
  const lockRef = useRef<Promise<unknown>>(Promise.resolve());
  const householdRef = useRef(householdId);
  /** Set when the server rejected a change; the next pull replaces the optimistic state. */
  const droppedRef = useRef(false);

  const setBoth = useCallback((next: HouseholdState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const setQueue = useCallback((queue: Changeset[]) => {
    queueRef.current = queue;
    saveQueue(householdRef.current, queue);
    setSync((s) => ({ ...s, pending: queue.length }));
  }, []);

  /** One async lock: flush and pull never run at the same time. */
  const lock = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const run = lockRef.current.then(() => fn());
    lockRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const goToLogin = useCallback(() => hardNavigate("/login"), []);

  const handleThrown = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Server Action")) {
      // A new deploy replaced the server action ids: reload once to get the new client.
      try {
        if (!window.sessionStorage.getItem(RELOAD_KEY)) {
          window.sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          return;
        }
      } catch {
        /* ignore */
      }
    }
    const network = !navigator.onLine || err instanceof TypeError;
    setSync((s) => (network ? { ...s, offline: true } : { ...s, serverDown: true }));
  }, []);

  const markHealthy = useCallback(() => {
    setSync((s) => (s.offline || s.serverDown ? { ...s, offline: false, serverDown: false } : s));
  }, []);

  /** Sends queued changesets in order. Resolves true when the queue is empty or a pull is still useful. */
  const flushInner = useCallback(async (): Promise<boolean> => {
    while (queueRef.current.length > 0) {
      const cs = queueRef.current[0];
      let res: Awaited<ReturnType<typeof applyChanges>>;
      try {
        res = await applyChanges(cs);
      } catch (err) {
        handleThrown(err);
        return false;
      }
      if (res.ok) {
        setQueue(queueRef.current.slice(1));
        markHealthy();
        continue;
      }
      if (res.error === "unauthorized") {
        goToLogin();
        return false;
      }
      if (res.error === "server") {
        setSync((s) => ({ ...s, serverDown: true }));
        return false;
      }
      // invalid or conflict: drop it, tell the user and take the server state.
      droppedRef.current = true;
      setQueue(queueRef.current.slice(1));
      setSync((s) => ({ ...s, failedAt: Date.now() }));
      return true;
    }
    return true;
  }, [goToLogin, handleThrown, markHealthy, setQueue]);

  const pullInner = useCallback(async () => {
    try {
      const res = await pullHousehold();
      if (!res.ok) {
        goToLogin();
        return;
      }
      droppedRef.current = false;
      setBoth(rebase(res.state, queueRef.current));
      markHealthy();
    } catch (err) {
      handleThrown(err);
    }
  }, [goToLogin, handleThrown, markHealthy, setBoth]);

  const flush = useCallback(() => lock(flushInner), [lock, flushInner]);
  const syncNow = useCallback(async () => {
    if (await flush()) await lock(pullInner);
  }, [flush, lock, pullInner]);

  // Mount: re-apply pending changes on top of the server state, then sync.
  useEffect(() => {
    householdRef.current = householdId;
    const queue = loadQueue(householdId);
    queueRef.current = queue;
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate pending changes once on the client */
    setBoth(rebase(initialState, queue));
    setSync((s) => ({ ...s, pending: queue.length, offline: !navigator.onLine }));
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    void syncNow();
    // initialState is only read on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Triggers: tab becomes visible, connection returns, and every 30 s while visible.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    const onOnline = () => void syncNow();
    const onOffline = () => setSync((s) => ({ ...s, offline: true }));
    const id = window.setInterval(onVisible, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [syncNow]);

  // PWA app badge: number of open signals on the home-screen icon.
  useEffect(() => {
    if (!ready) return;
    const open = state.signals.filter((s) => s.openedAt).length;
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (open > 0) nav.setAppBadge?.(open).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [state.signals, ready]);

  const update = useCallback(
    (fn: Updater) => {
      const prev = stateRef.current;
      const next = fn(prev);
      const changes = diffState(prev, next);
      setBoth(next);
      if (changes.length > 0) {
        setQueue([...queueRef.current, { id: crypto.randomUUID(), changes }]);
        void flush().then((ok) => {
          // A rejected change stays on screen until the server state replaces it.
          if (ok && droppedRef.current) void lock(pullInner);
        });
      }
      return next;
    },
    [flush, lock, pullInner, setBoth, setQueue],
  );

  const snapshot = useCallback(() => stateRef.current, []);

  const value = useMemo(
    () => ({ state, ready, update, snapshot, account, sync, refresh: syncNow }),
    [state, ready, update, snapshot, account, sync, syncNow],
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
