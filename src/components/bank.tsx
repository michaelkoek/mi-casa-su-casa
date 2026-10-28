"use client";

import { ArrowClockwise, Bank, CaretRight, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { listBanks, refreshBank, startBankLink, unlinkBank, type BankOption } from "@/app/actions/bank";
import { consentDaysLeft } from "@/lib/bank-mapping";
import { formatTime, toDateKey } from "@/lib/logic";
import { useHousehold, useNow } from "@/lib/store";
import type { BankStatus } from "@/lib/types";
import { SoftButton } from "./form";
import { Sheet } from "./sheet";
import { useUI } from "./ui-provider";

/** Days before the consent ends that the Geld tab starts mentioning it. */
const CONSENT_NOTICE_DAYS = 14;

/** Linked banks with their status, the refresh button, and the way to link (another) bank. */
export function BankStrip() {
  const t = useTranslations("bank");
  const { state, refresh } = useHousehold();
  const { toast } = useUI();
  const now = useNow();
  const [picking, setPicking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const banks = state.bank;

  // Result of the bank redirect (/geld?bank=linked|cancelled|failed): one toast, then a clean URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("bank");
    if (!result) return;
    const key = result === "linked" ? "linked" : result === "cancelled" ? "cancelled" : "linkFailed";
    toast(t(key));
    params.delete("bank");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [t, toast]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await refreshBank();
      if (res.ok) {
        await refresh();
        toast(res.expired ? t("refreshExpired") : t("refreshed", { count: res.imported }));
      } else {
        toast(t(res.error === "unavailable" ? "unavailable" : "failed"));
      }
    } catch {
      toast(t("failed"));
    } finally {
      setRefreshing(false);
    }
  };

  if (banks.length === 0) {
    return (
      <>
        <button type="button" onClick={() => setPicking(true)}
          className="press mt-3 flex w-full items-center gap-3 rounded-[22px] bg-surface p-4 text-left">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-bg"><Bank size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("link")}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{t("linkSub")}</span>
          </span>
          <CaretRight size={18} className="flex-none text-ink-3" />
        </button>
        <BankPicker open={picking} onClose={() => setPicking(false)} />
      </>
    );
  }

  const soonest = banks
    .filter((b) => b.status === "active")
    .map((b) => ({ bank: b, days: consentDaysLeft(b.consentUntil, now) }))
    .sort((a, b) => a.days - b.days)[0];

  return (
    <>
      <div className="mt-3 rounded-[22px] bg-surface px-4">
        {banks.map((b) => (
          <BankRow key={b.id} bank={b} now={now} onRelink={() => setPicking(true)} />
        ))}
        <div className="flex items-center gap-2 border-t border-line py-1.5">
          <button type="button" onClick={() => setPicking(true)}
            className="press -ml-2 flex h-11 items-center gap-1.5 rounded-xl px-2 text-[13px] font-medium text-ink-2">
            <Plus size={16} /> {t("linkAnother")}
          </button>
          <button type="button" onClick={onRefresh} disabled={refreshing} aria-label={t("refresh")}
            className="press -mr-1.5 ml-auto grid h-11 w-11 place-items-center rounded-full">
            <ArrowClockwise size={18} className={clsx(refreshing && "animate-spin")} />
          </button>
        </div>
      </div>
      {soonest && soonest.days <= CONSENT_NOTICE_DAYS && (
        <p className="mt-2.5 px-1 text-[13px] text-ink-3">
          {t("consent", { bank: soonest.bank.name, days: Math.max(0, soonest.days) })}
        </p>
      )}
      <BankPicker open={picking} onClose={() => setPicking(false)} />
    </>
  );
}

function BankRow({ bank, now, onRelink }: { bank: BankStatus; now: Date; onRelink: () => void }) {
  const t = useTranslations("bank");
  const { refresh } = useHousehold();
  const { toast } = useUI();
  const synced = bank.syncedAt
    ? t("synced", {
        time:
          toDateKey(new Date(bank.syncedAt)) === toDateKey(now)
            ? formatTime(bank.syncedAt)
            : new Date(bank.syncedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
      })
    : t("never");
  const problem = bank.status === "expired" ? t("expired") : bank.status === "error" ? t("error") : null;
  // Unlinking cannot be undone (it ends the consent at the bank), so it takes a second tap.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(id);
  }, [armed]);

  const onUnlink = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    const res = await unlinkBank({ id: bank.id });
    if (res.ok) {
      await refresh();
      toast(t("unlinked", { bank: bank.name }));
    } else toast(t("failed"));
  };

  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <Bank size={20} className="flex-none text-ink-2" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{bank.name}</p>
        <p className={clsx("text-[13px]", problem ? "font-medium text-bad" : "text-ink-3")}>
          {problem ?? synced}
          {!problem && bank.accounts.length > 1 && ` · ${bank.accounts.length}`}
        </p>
      </div>
      {problem ? (
        <button type="button" onClick={onRelink} className="press h-11 rounded-xl bg-bg px-3 text-[13px] font-semibold">
          {t("relink")}
        </button>
      ) : (
        <button type="button" onClick={onUnlink}
          className={clsx("press h-11 rounded-xl px-2 text-[13px] font-medium", armed ? "bg-bg text-bad" : "text-ink-3")}>
          {armed ? t("unlinkConfirm") : t("unlink")}
        </button>
      )}
    </div>
  );
}

type PickerState = { status: "loading" } | { status: "ready"; banks: BankOption[] } | { status: "error"; reason: "unavailable" | "failed" };

/** Bottom sheet with the Dutch banks; choosing one sends you to the bank to give consent. */
function BankPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("bank");
  const [state, setState] = useState<PickerState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [going, setGoing] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listBanks()
      .then((res) => {
        if (!alive) return;
        setState(res.ok ? { status: "ready", banks: res.banks } : { status: "error", reason: res.error === "unavailable" ? "unavailable" : "failed" });
      })
      .catch(() => alive && setState({ status: "error", reason: "failed" }));
    return () => {
      alive = false;
    };
  }, [open, attempt]);

  const choose = async (name: string) => {
    setGoing(name);
    try {
      const res = await startBankLink({ name });
      if (res.ok) {
        window.location.assign(res.url);
        return;
      }
      setState({ status: "error", reason: res.error === "unavailable" ? "unavailable" : "failed" });
    } catch {
      setState({ status: "error", reason: "failed" });
    }
    setGoing(null);
  };

  const q = query.trim().toLowerCase();
  const banks = state.status === "ready" ? state.banks.filter((b) => b.name.toLowerCase().includes(q)) : [];

  return (
    <Sheet open={open} onClose={onClose} title={t("pickTitle")}>
      <h2 className="mb-3 mt-1 text-xl font-bold">{t("pickTitle")}</h2>
      <label className="flex h-12 items-center gap-2 rounded-2xl bg-surface px-3.5">
        <MagnifyingGlass size={18} className="text-ink-3" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")}
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3" />
      </label>

      {state.status === "loading" && (
        <div aria-hidden="true" className="mt-3 flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-4 rounded-[22px] bg-surface p-4 text-sm">
          <p>{t(state.reason)}</p>
          {state.reason === "failed" && (
            <SoftButton className="mt-3 w-full" onClick={() => { setState({ status: "loading" }); setAttempt((n) => n + 1); }}>
              {t("retry")}
            </SoftButton>
          )}
        </div>
      )}

      {state.status === "ready" && (
        <ul className="mt-3 flex flex-col">
          {banks.length === 0 && <li className="py-4 text-sm text-ink-3">{t("noMatch")}</li>}
          {banks.map((b) => (
            <li key={b.name}>
              <button type="button" disabled={going !== null} onClick={() => choose(b.name)}
                className="press flex min-h-14 w-full items-center gap-3 border-b border-line py-2 text-left disabled:opacity-60">
                {b.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote bank logos, small and few
                  <img src={b.logo} alt="" width={32} height={32} className="h-8 w-8 flex-none rounded-lg bg-white object-contain" />
                ) : (
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-surface"><Bank size={18} /></span>
                )}
                <span className="flex-1 font-medium">{b.name}</span>
                {b.beta && <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-3">{t("beta")}</span>}
                {going === b.name ? <ArrowClockwise size={18} className="animate-spin text-ink-3" /> : <CaretRight size={18} className="text-ink-3" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
