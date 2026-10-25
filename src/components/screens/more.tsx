"use client";

import { CalendarBlank, CaretLeft, CaretRight, CookingPot, Envelope, GearSix, Plus, ShareNetwork, Trash } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  addShopping,
  clearCheckedShopping,
  planMeal,
  recipeToShopping,
  renameMember,
  toggleShopping,
} from "@/lib/actions";
import { addDays, formatTime, toDateKey } from "@/lib/logic";
import { deletePushSubscription } from "@/app/actions/push";
import { authClient } from "@/lib/auth-client";
import { hardNavigate } from "@/lib/navigate";
import { useHousehold, useMemberName, useNow } from "@/lib/store";
import { ChoiceGroup, Checkbox, Field, SoftButton } from "../form";
import { PushSettings } from "../push-settings";
import { PageHeader, Screen, SectionTitle } from "../screen";
import { Sheet } from "../sheet";
import { useUI } from "../ui-provider";

/* ---------- Meer ---------- */

export function MoreScreen() {
  return (
    <Screen>
      <More />
    </Screen>
  );
}

function More() {
  const t = useTranslations("more");
  const { state } = useHousehold();
  const shopping = state.shopping.filter((s) => !s.checked).length;
  const now = useNow();
  const week = state.events.filter((e) => {
    const d = new Date(e.start).getTime() - now.getTime();
    return d > -3600000 && d < 7 * 86400000;
  }).length;

  const row = (href: string, tone: string, Icon: typeof CookingPot, title: string, sub: string, i: number, extra?: ReactNode) => (
    <Link href={href} transitionTypes={["nav-forward"]} style={{ ["--i" as string]: i }}
      className={clsx("press rise mb-2 flex min-h-16 items-center gap-3.5 rounded-[20px] p-3", tone)}>
      <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[14px] bg-bg"><Icon size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="text-[13px] text-ink-2">{sub}</span>
      </span>
      {extra ?? <CaretRight size={18} className="text-ink-3" />}
    </Link>
  );

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <div className="mt-[18px]">
        {row("/meer/eten", "bg-tile-food", CookingPot, t("food"), t("foodSub", { count: shopping }), 0)}
        {row("/meer/agenda", "bg-tile-agenda", CalendarBlank, t("agenda"), t("agendaSub", { count: week }), 1)}
        <div style={{ ["--i" as string]: 2 }} className="rise mb-2 flex min-h-16 items-center gap-3.5 rounded-[20px] bg-tile-jobs p-3 opacity-80">
          <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[14px] bg-bg"><Envelope size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("mail")}</span>
            <span className="text-[13px] text-ink-2">{t("mailSub")}</span>
          </span>
          <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-ink-2">{t("later")}</span>
        </div>
        {row("/meer/instellingen", "bg-surface", GearSix, t("settings"), t("settingsSub"), 3)}
      </div>
    </>
  );
}

function BackHeader({ title, eyebrow }: { title: string; eyebrow: string }) {
  const t = useTranslations("more");
  return (
    <>
      <Link href="/meer" transitionTypes={["nav-back"]} className="press -ml-2 mb-2 inline-flex h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-ink-2">
        <CaretLeft size={18} /> {t("back")}
      </Link>
      <PageHeader eyebrow={eyebrow} title={title} />
    </>
  );
}

/* ---------- Eten ---------- */

export function FoodScreen() {
  return (
    <Screen>
      <Food />
    </Screen>
  );
}

function Food() {
  const t = useTranslations("food");
  const { state, update } = useHousehold();
  const nameOf = useMemberName();
  const now = useNow();
  const { act, toast } = useUI();
  const [item, setItem] = useState("");
  const [planDate, setPlanDate] = useState<string | null>(null);
  const today = toDateKey(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const open = state.shopping.filter((s) => !s.checked);
  const done = state.shopping.filter((s) => s.checked);

  const addItem = (e: FormEvent) => {
    e.preventDefault();
    if (!item.trim()) return;
    update(addShopping(item.trim()));
    setItem("");
  };

  return (
    <>
      <BackHeader eyebrow={t("eyebrow")} title={t("title")} />

      <SectionTitle aside={t("tapToPlan")}>{t("week")}</SectionTitle>
      <div className="-mx-[18px] flex gap-2.5 overflow-x-auto px-[18px] pb-1 [scrollbar-width:none]">
        {days.map((d, i) => {
          const meal = state.mealPlan.find((m) => m.date === d);
          const recipe = meal && state.recipes.find((r) => r.id === meal.recipeId);
          const date = new Date(d + "T12:00:00");
          return (
            <button key={d} type="button" onClick={() => setPlanDate(d)} style={{ ["--i" as string]: i }}
              className={clsx("press rise flex h-36 w-32 flex-none flex-col justify-between rounded-[22px] p-3.5 text-left",
                d === today ? "bg-hero text-white" : recipe ? "bg-tile-food" : "bg-surface")}>
              <span className={clsx("text-xs font-semibold", d === today ? "text-[var(--hero-sub)]" : "text-ink-3")}>
                {d === today ? t("today") : date.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric" })}
              </span>
              <span>
                <span className="block text-sm font-semibold leading-tight">{recipe ? recipe.name : t("nothing")}</span>
                {meal && (
                  <span className={clsx("text-xs", d === today ? "text-[var(--hero-sub)]" : "text-ink-2")}>
                    {meal.cookId === state.me ? t("youCook") : t("cooks", { name: nameOf(meal.cookId) })}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <SectionTitle aside={t("itemsLeft", { count: open.length })}>{t("shopping")}</SectionTitle>
      <form onSubmit={addItem} className="mb-2.5 flex gap-2">
        <label htmlFor="shop-add" className="sr-only">{t("addItem")}</label>
        <input id="shop-add" value={item} onChange={(e) => setItem(e.target.value)} placeholder={t("addItem")}
          className="h-12 min-w-0 flex-1 rounded-2xl bg-surface px-4 outline-none ring-accent-strong focus:ring-2" />
        <button type="submit" aria-label={t("addItem")} className="press grid h-12 w-12 place-items-center rounded-2xl bg-accent-strong text-white">
          <Plus size={20} weight="bold" />
        </button>
      </form>
      <div className="rounded-[22px] bg-surface px-4 py-1">
        {open.length === 0 && <p className="py-4 text-sm text-ink-3">{t("listEmpty")}</p>}
        <AnimatePresence initial={false}>
          {open.map((s) => (
            <motion.button layout key={s.id} type="button" exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
              onClick={() => update(toggleShopping(s.id))}
              className="flex min-h-[52px] w-full items-center gap-3 border-b border-line text-left last:border-b-0">
              <Checkbox done={false} />
              <span className="flex-1">{s.name}</span>
              {s.source !== "manual" && <span className="text-xs text-ink-3">{t(`source.${s.source}`)}</span>}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      {done.length > 0 && (
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="text-[13px] text-ink-3">{t("checked", { count: done.length })}</span>
          <button type="button" className="press inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-accent-strong"
            onClick={() => act(t("cleared"), clearCheckedShopping)}>
            <Trash size={16} /> {t("clear")}
          </button>
        </div>
      )}

      <PlanSheet date={planDate} onClose={() => setPlanDate(null)} onPlanned={(name) => toast(t("planned", { name }))} />
    </>
  );
}

function PlanSheet({ date, onClose, onPlanned }: { date: string | null; onClose: () => void; onPlanned: (name: string) => void }) {
  const t = useTranslations("food.plan");
  const { state, update } = useHousehold();
  const current = state.mealPlan.find((m) => m.date === date);
  const [cook, setCook] = useState(current?.cookId ?? state.me);

  return (
    <Sheet open={date !== null} onClose={onClose}
      title={date ? new Date(date + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }) : ""}>
      <div className="flex flex-col gap-5">
        <ChoiceGroup label={t("cook")} value={cook} onChange={setCook}
          options={state.members.map((m) => ({ value: m.id, label: m.id === state.me ? t("me") : m.name }))} />
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-ink-2">{t("recipe")}</p>
          {state.recipes.map((r) => (
            <button key={r.id} type="button"
              className={clsx("press flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 text-left",
                current?.recipeId === r.id ? "bg-accent-soft" : "bg-surface")}
              onClick={() => {
                if (!date) return;
                update((s) => recipeToShopping(r.id)(planMeal(date, r.id, cook)(s)));
                onClose();
                onPlanned(r.name);
              }}>
              <span>
                <span className="block font-medium">{r.name}</span>
                <span className="text-xs text-ink-3">{r.ingredients.join(", ")}</span>
              </span>
            </button>
          ))}
          <p className="text-[13px] text-ink-3">{t("hint")}</p>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Agenda ---------- */

export function AgendaScreen() {
  return (
    <Screen>
      <Agenda />
    </Screen>
  );
}

function Agenda() {
  const t = useTranslations("agenda");
  const { state } = useHousehold();
  const now = useNow();
  const today = toDateKey(now);
  const items = [
    ...state.events.map((e) => ({ id: e.id, title: e.title, start: e.start, allDay: e.allDay, kind: "calendar" as const })),
    ...state.appointments.map((a) => ({ id: a.id, title: a.title, start: a.at, allDay: false, kind: "child" as const })),
  ]
    .filter((e, i, arr) => arr.findIndex((x) => x.title === e.title && x.start === e.start) === i)
    .filter((e) => toDateKey(new Date(e.start)) >= today)
    .sort((a, b) => a.start.localeCompare(b.start));

  const groups = items.reduce<Record<string, typeof items>>((acc, e) => {
    const key = toDateKey(new Date(e.start));
    (acc[key] ||= []).push(e);
    return acc;
  }, {});

  return (
    <>
      <BackHeader eyebrow={t("eyebrow")} title={t("title")} />
      <p className="mt-2 text-[13px] text-ink-3">{t("source")}</p>
      {Object.entries(groups).map(([day, list], gi) => (
        <section key={day} style={{ ["--i" as string]: gi }} className="rise">
          <SectionTitle>
            {day === today ? t("today") : day === addDays(today, 1) ? t("tomorrow")
              : new Date(day + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
          </SectionTitle>
          <div className="rounded-[22px] bg-surface px-4 py-1">
            {list.map((e) => (
              <div key={e.id} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
                <span className="num w-14 text-[13px] text-ink-3">{e.allDay ? t("allDay") : formatTime(e.start)}</span>
                <span className="flex-1 font-medium">{e.title}</span>
                {e.kind === "child" && <span className="rounded-full bg-tile-child px-2 py-0.5 text-xs font-medium">{t("childTag")}</span>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/* ---------- Instellingen ---------- */

export function SettingsScreen() {
  return (
    <Screen>
      <Settings />
    </Screen>
  );
}

function Settings() {
  const t = useTranslations("settings");
  const tp = useTranslations("push");
  const { state, update, account } = useHousehold();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      // Best effort: drop this device's push subscription and cached pages before leaving.
      const reg = await navigator.serviceWorker?.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription({ endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    } catch {
      /* signing out must not depend on cleanup */
    }
    await authClient.signOut().catch(() => {});
    hardNavigate("/login");
  };

  return (
    <>
      <BackHeader eyebrow={t("eyebrow")} title={t("title")} />

      <SectionTitle>{t("members")}</SectionTitle>
      <div className="flex flex-col gap-3">
        {state.members.map((m, i) => (
          <Field key={m.id} label={t("memberLabel", { n: i + 1 })} defaultValue={m.name}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== m.name && update(renameMember(m.id, e.target.value.trim()))} />
        ))}
      </div>

      <SectionTitle>{tp("title")}</SectionTitle>
      <PushSettings />

      <SectionTitle>{t("account")}</SectionTitle>
      <p className="mb-3 text-sm text-ink-2">{t("signedInAs", { email: account.email })}</p>
      <SoftButton className="w-full" onClick={signOut} disabled={signingOut}>{t("signOut")}</SoftButton>

      <SectionTitle>{t("install")}</SectionTitle>
      <div className="flex gap-3 rounded-[22px] bg-tile-money p-4 text-sm">
        <ShareNetwork size={22} className="flex-none" />
        <p>{t("installHelp")}</p>
      </div>
    </>
  );
}
