"use client";

import { Basket, CalendarBlank, CaretDown, CaretLeft, CaretRight, Envelope, GearSix, Plus, ShareNetwork, Sparkle, Storefront, Trash, type Icon } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  addShopping,
  clearMeal,
  deleteShopping,
  planDay,
  renameMember,
  toggleShopping,
} from "@/lib/actions";
import {
  addDays,
  formatTime,
  missingIngredients,
  normalizeItem,
  parseIngredients,
  suggestMeals,
  toDateKey,
} from "@/lib/logic";
import type { MealIdea } from "@/lib/meal-ideas";
import { suggestMealsAI } from "@/app/actions/meals";
import { deletePushSubscription, notifyShoppingTrip } from "@/app/actions/push";
import { authClient } from "@/lib/auth-client";
import { hardNavigate } from "@/lib/navigate";
import { useHousehold, useMemberName, useNow } from "@/lib/store";
import { ChoiceGroup, Checkbox, Field, PrimaryButton, SoftButton } from "../form";
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

  const row = (href: string, tone: string, Icon: Icon, title: string, sub: string, i: number, extra?: ReactNode) => (
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
        {row("/meer/boodschappen", "bg-tile-food", Basket, t("shopping"), t("shoppingSub", { count: shopping }), 0)}
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

/* ---------- Boodschappen ---------- */

export function ShoppingScreen() {
  return (
    <Screen>
      <Shopping />
    </Screen>
  );
}

const ROW_MOTION = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
};

function Shopping() {
  const t = useTranslations("shopping");
  const { state, update, sync } = useHousehold();
  const nameOf = useMemberName();
  const now = useNow();
  const { act, toast } = useUI();
  const [item, setItem] = useState("");
  const [planDate, setPlanDate] = useState<string | null>(null);
  const [inHouseOpen, setInHouseOpen] = useState(false);
  const [tripAt, setTripAt] = useState<number | null>(null);
  const [tripBusy, setTripBusy] = useState(false);
  const today = toDateKey(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const toBuy = state.shopping.filter((s) => !s.checked);
  const inHouse = state.shopping.filter((s) => s.checked);
  const cooling = tripAt !== null && now.getTime() - tripAt < 10 * 60_000;

  const addItem = (e: FormEvent) => {
    e.preventDefault();
    const name = item.trim();
    if (!name) return;
    update(addShopping(name));
    setItem("");
  };

  const trip = async () => {
    if (sync.offline || !navigator.onLine) return toast(t("offline"));
    setTripBusy(true);
    try {
      const res = await notifyShoppingTrip();
      if (res.ok) {
        setTripAt(Date.now());
        toast(res.sent > 0 ? t("tripSent") : t("tripNone"));
      } else {
        toast(t("tripFailed"));
      }
    } catch {
      toast(t("tripFailed"));
    } finally {
      setTripBusy(false);
    }
  };

  const trash = (s: { id: string; name: string }) => (
    <button type="button" aria-label={t("delete", { name: s.name })}
      className="press grid h-11 w-11 flex-none place-items-center rounded-xl text-ink-3"
      onClick={() => act(t("deleted", { name: s.name }), deleteShopping(s.id))}>
      <Trash size={18} />
    </button>
  );

  return (
    <>
      <BackHeader eyebrow={t("eyebrow")} title={t("title")} />

      <SectionTitle
        aside={
          state.members.length > 1 && (
            <button type="button" onClick={trip} disabled={cooling || tripBusy}
              className="press -my-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-accent-strong disabled:opacity-50">
              <Storefront size={18} /> {cooling ? t("tripDone") : t("trip")}
            </button>
          )
        }>
        {t("toBuy", { count: toBuy.length })}
      </SectionTitle>
      <form onSubmit={addItem} className="mb-2.5 flex gap-2">
        <label htmlFor="shop-add" className="sr-only">{t("addItem")}</label>
        <input id="shop-add" value={item} maxLength={100} onChange={(e) => setItem(e.target.value)} placeholder={t("addItem")}
          className="h-12 min-w-0 flex-1 rounded-2xl bg-surface px-4 outline-none ring-accent-strong focus:ring-2" />
        <button type="submit" aria-label={t("addItem")} className="press grid h-12 w-12 place-items-center rounded-2xl bg-accent-strong text-white">
          <Plus size={20} weight="bold" />
        </button>
      </form>
      <div className="rounded-[22px] bg-surface px-4 py-1">
        {toBuy.length === 0 && <p className="py-4 text-sm text-ink-3">{t("toBuyEmpty")}</p>}
        <AnimatePresence initial={false}>
          {toBuy.map((s) => (
            <motion.div layout key={s.id} {...ROW_MOTION} className="flex items-center border-b border-line last:border-b-0">
              <button type="button" onClick={() => update(toggleShopping(s.id))}
                className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 text-left">
                <Checkbox done={false} />
                <span className="flex-1">{s.name}</span>
                {s.source !== "manual" && <span className="text-xs text-ink-3">{t(`source.${s.source}`)}</span>}
              </button>
              {trash(s)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <button type="button" aria-expanded={inHouseOpen} onClick={() => setInHouseOpen((o) => !o)}
        className="press mx-0.5 mt-7 flex min-h-11 w-full items-center justify-between text-left text-[13px] font-semibold text-ink-3">
        <span>{t("inHouse", { count: inHouse.length })}</span>
        <CaretDown size={16} className={clsx("transition-transform duration-200", inHouseOpen && "rotate-180")} />
      </button>
      {inHouseOpen && (
        <div className="mt-1 rounded-[22px] bg-surface px-4 py-1">
          {inHouse.length === 0 && <p className="py-4 text-sm text-ink-3">{t("inHouseEmpty")}</p>}
          <AnimatePresence initial={false}>
            {inHouse.map((s) => (
              <motion.div layout key={s.id} {...ROW_MOTION} className="flex items-center border-b border-line last:border-b-0">
                <button type="button" onClick={() => update(toggleShopping(s.id))}
                  className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 text-left">
                  <Checkbox done />
                  <span className="flex-1 text-ink-2">{s.name}</span>
                </button>
                {trash(s)}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <SectionTitle aside={t("tapToPlan")}>{t("week")}</SectionTitle>
      <div className="-mx-[18px] flex gap-2.5 overflow-x-auto px-[18px] pb-1 [scrollbar-width:none]">
        {days.map((d, i) => {
          const meal = state.mealPlan.find((m) => m.date === d);
          const date = new Date(d + "T12:00:00");
          return (
            <button key={d} type="button" onClick={() => setPlanDate(d)} style={{ ["--i" as string]: i }}
              className={clsx("press rise flex h-36 w-32 flex-none flex-col justify-between rounded-[22px] p-3.5 text-left",
                d === today ? "bg-hero text-white" : meal ? "bg-tile-food" : "bg-surface")}>
              <span className={clsx("text-xs font-semibold", d === today ? "text-[var(--hero-sub)]" : "text-ink-3")}>
                {d === today ? t("today") : date.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric" })}
              </span>
              <span>
                <span className="block text-sm font-semibold leading-tight">{meal ? meal.title : t("nothing")}</span>
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

      <PlanSheet date={planDate} onClose={() => setPlanDate(null)} />
    </>
  );
}

function PlanSheet({ date, onClose }: { date: string | null; onClose: () => void }) {
  return (
    <Sheet open={date !== null} onClose={onClose}
      title={date ? new Date(date + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }) : ""}>
      {date && <PlanForm key={date} date={date} onDone={onClose} />}
    </Sheet>
  );
}

function PlanForm({ date, onDone }: { date: string; onDone: () => void }) {
  const t = useTranslations("shopping.plan");
  const ts = useTranslations("shopping");
  const { state, sync } = useHousehold();
  const { act, toast } = useUI();
  const current = state.mealPlan.find((m) => m.date === date);
  const currentRecipe = current?.recipeId ? state.recipes.find((r) => r.id === current.recipeId) : undefined;
  const [cook, setCook] = useState(current?.cookId ?? state.me);
  const [title, setTitle] = useState(current?.title ?? "");
  const [ingredients, setIngredients] = useState(currentRecipe ? currentRecipe.ingredients.join(", ") : "");
  const [titleError, setTitleError] = useState(false);
  const [ideas, setIdeas] = useState<MealIdea[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHidden, setAiHidden] = useState(false);

  const fill = (name: string, list: string[]) => {
    setTitle(name);
    setIngredients(list.join(", "));
    setTitleError(false);
  };

  const key = normalizeItem(title);
  const quick = key
    ? state.recipes.filter((r) => normalizeItem(r.name).includes(key) && normalizeItem(r.name) !== key).slice(0, 4)
    : [];
  const suggestions = suggestMeals(state.recipes, state.shopping).filter((x) => x.have.length > 0).slice(0, 3);

  const surprise = async () => {
    if (sync.offline || !navigator.onLine) return toast(t("offline"));
    setAiLoading(true);
    try {
      const res = await suggestMealsAI();
      if (res.ok) setIdeas(res.ideas);
      else if (res.error === "unavailable") {
        toast(t("surpriseUnavailable"));
        setAiHidden(true);
      } else toast(t("surpriseFailed"));
    } catch {
      toast(t("surpriseFailed"));
    } finally {
      setAiLoading(false);
    }
  };

  const save = () => {
    if (!title.trim()) return setTitleError(true);
    const list = parseIngredients(ingredients);
    const count = missingIngredients(list, state.shopping).length;
    act(t("planned", { name: title.trim(), count }), planDay(date, { title, ingredients: list, cookId: cook }));
    onDone();
  };

  const pick = "press min-h-14 rounded-2xl bg-surface px-4 py-2 text-left";

  return (
    <div className="flex flex-col gap-5">
      <ChoiceGroup label={t("cook")} value={cook} onChange={setCook}
        options={state.members.map((m) => ({ value: m.id, label: m.id === state.me ? t("me") : m.name }))} />

      <Field label={t("what")} placeholder={t("whatPlaceholder")} maxLength={100} value={title}
        onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
        error={titleError ? t("whatError") : null} />

      {quick.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-ink-2">{t("recipes")}</p>
          <div className="flex flex-wrap gap-2">
            {quick.map((r) => (
              <button key={r.id} type="button" className="press h-11 rounded-full bg-surface px-4 text-sm"
                onClick={() => fill(r.name, r.ingredients)}>
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <Field label={t("ingredients")} placeholder={t("ingredientsPlaceholder")} hint={t("ingredientsHint")} value={ingredients}
        onChange={(e) => setIngredients(e.target.value)} />

      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-semibold text-ink-2">{t("suggestions")}</p>
        {suggestions.length === 0 && <p className="text-[13px] text-ink-3">{t("noSuggestions")}</p>}
        {suggestions.map((x) => (
          <button key={x.recipe.id} type="button" className={pick} onClick={() => fill(x.recipe.name, x.recipe.ingredients)}>
            <span className="block font-medium">{x.recipe.name}</span>
            <span className="text-xs text-ink-3">
              {x.missing.length === 0
                ? t("suggestionComplete")
                : t("suggestion", { have: x.have.length, total: x.recipe.ingredients.length, names: x.missing.join(", ") })}
            </span>
          </button>
        ))}
        {!aiHidden && (
          <SoftButton onClick={surprise} disabled={aiLoading}>
            <Sparkle size={18} /> {t("surprise")}
          </SoftButton>
        )}
        {aiLoading && Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}
        {!aiLoading && ideas?.map((idea, i) => (
          <button key={`${i}-${idea.title}`} type="button" className={pick} onClick={() => fill(idea.title, idea.ingredients)}>
            <span className="block font-medium">{idea.title}</span>
            <span className="text-xs text-ink-3">{idea.ingredients.join(", ")}</span>
          </button>
        ))}
      </div>

      <PrimaryButton type="button" onClick={save}>{t("save")}</PrimaryButton>
      {current && (
        <SoftButton className="w-full" onClick={() => { act(ts("cleared"), clearMeal(date)); onDone(); }}>
          {t("clear")}
        </SoftButton>
      )}
    </div>
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
