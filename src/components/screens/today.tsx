"use client";

import { ArrowRight, Bell } from "@phosphor-icons/react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { doneChore, toggleSignal, toggleTask } from "@/lib/actions";
import { budgetSummary, formatEuro, formatTime, minutesAgo, missingIngredients, nextAssignee, toDateKey, weekdayName as dayShort } from "@/lib/logic";
import { useHousehold, useMemberName, useNow } from "@/lib/store";
import { Checkbox } from "../form";
import { BinArt, BlocksArt, CalendarArt, LaundryArt, PiggyArt, PlateArt, PumpkinArt, ToolboxArt } from "../illustrations";
import { Screen } from "../screen";
import { useUI } from "../ui-provider";

export function TodayScreen() {
  return (
    <Screen>
      <Today />
    </Screen>
  );
}

function Today() {
  const t = useTranslations("today");
  const { state } = useHousehold();
  const nameOf = useMemberName();
  const now = useNow();
  const { act } = useUI();
  const [view, setView] = useState<"overview" | "todo">("overview");
  const today = toDateKey(now);
  const me = state.members.find((m) => m.id === state.me)!;

  const openSignals = state.signals.filter((s) => s.openedAt);
  const todayTasks = state.tasks.filter((x) => x.due !== null && x.due <= today && (!x.doneAt || x.doneAt.slice(0, 10) === today));
  const dueChores = state.chores.filter((c) => c.nextDue <= today);
  const openCount = todayTasks.filter((x) => !x.doneAt).length + dueChores.length;

  return (
    <>
      <header className="mb-[18px] flex items-center gap-2.5">
        <Link href="/meer" transitionTypes={["nav-forward"]} aria-label={t("moreLabel")}
          className="press grid h-10 w-10 flex-none place-items-center rounded-full bg-accent-soft text-[15px] font-bold text-accent-strong">
          {me.name.charAt(0)}
        </Link>
        <div>
          <p className="font-semibold">{t("hello", { name: me.name })}</p>
          <p className="text-xs text-ink-3">{now.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <Link href="/huis" transitionTypes={["nav-forward"]} aria-label={t("signalsLabel", { count: openSignals.length })}
          className="press relative ml-auto grid h-11 w-11 place-items-center rounded-full">
          <Bell size={24} />
          {openSignals.length > 0 && (
            <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full border-2 border-bg bg-accent px-1 text-[10px] font-bold text-white">
              {openSignals.length}
            </span>
          )}
        </Link>
      </header>

      <Hero />

      <div role="tablist" className="mx-0.5 mb-3.5 mt-6 flex items-baseline gap-8">
        {(["overview", "todo"] as const).map((v) => (
          <button key={v} role="tab" type="button" aria-selected={view === v} onClick={() => setView(v)}
            className={clsx("origin-bottom-left text-sm transition-all duration-300 ease-out",
              view === v ? "scale-[1.3] font-bold text-ink" : "font-medium text-ink-3")}>
            {v === "overview" ? t("overview") : t("todo", { count: openCount })}
          </button>
        ))}
      </div>

      {view === "overview" ? (
        <Bento openCount={openCount} />
      ) : (
        <div className="pop rounded-[24px] bg-surface px-4 py-1">
          {todayTasks.length + dueChores.length === 0 && <p className="py-5 text-center text-ink-3">{t("nothingToDo")}</p>}
          {dueChores.map((c) => (
            <button key={c.id} type="button" className="flex min-h-14 w-full items-center gap-3 border-b border-line py-3 text-left last:border-b-0"
              onClick={() => act(t("choreDone", { title: c.title }), doneChore(c.id, new Date()))}>
              <Checkbox done={false} />
              <span>{c.title}</span>
              <span className="ml-auto whitespace-nowrap text-xs text-ink-3">{nameOf(nextAssignee(c))} · {t("chore")}</span>
            </button>
          ))}
          {todayTasks.map((task) => {
            const done = !!task.doneAt;
            return (
              <button key={task.id} type="button" aria-pressed={done}
                className="flex min-h-14 w-full items-center gap-3 border-b border-line py-3 text-left last:border-b-0"
                onClick={() => act(done ? t("reopened") : t("checked"), toggleTask(task.id, new Date()))}>
                <Checkbox done={done} />
                <span className={clsx("transition-colors duration-200", done && "text-ink-3 line-through")}>{task.title}</span>
                <span className="ml-auto whitespace-nowrap text-xs text-ink-3">
                  {task.assigneeId === state.me ? t("you") : nameOf(task.assigneeId)}
                  {task.dueLabel ? ` · ${task.dueLabel}` : task.due && task.due < today ? ` · ${t("overdue")}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function Hero() {
  const t = useTranslations("today.hero");
  const { state } = useHousehold();
  const nameOf = useMemberName();
  const now = useNow();
  const { act } = useUI();
  const today = toDateKey(now);
  const signal = state.signals.find((s) => s.openedAt);
  const meal = state.mealPlan.find((m) => m.date === today);
  const recipe = meal?.recipeId ? state.recipes.find((r) => r.id === meal.recipeId) : undefined;

  const shell = (key: string, eyebrow: string, title: string, sub: string, action: ReactNode, art: ReactNode) => (
    <section key={key} className="pop relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-[26px] bg-hero p-5 text-white">
      <div className="relative z-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--hero-sub)]">{eyebrow}</p>
        <h2 className="mt-1.5 max-w-[12ch] text-[22px] font-bold leading-tight">{title}</h2>
        <p className="mt-1.5 max-w-[22ch] text-[13px] font-medium text-[var(--hero-sub)]">{sub}</p>
      </div>
      <div className="relative z-10 mt-3.5">{action}</div>
      <div className="pointer-events-none absolute -bottom-3 -right-3.5">{art}</div>
    </section>
  );
  const btn = "press inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-accent-strong";

  if (signal) {
    const mine = signal.openedBy === state.me;
    const mins = minutesAgo(signal.openedAt!, now);
    return shell(
      signal.id,
      t("signalEyebrow", { minutes: mins }),
      signal.label,
      mine ? t("signalMine") : t("signalOther", { name: nameOf(signal.openedBy) }),
      <button type="button" className={btn} onClick={() => act(t("signalDone", { label: signal.label }), toggleSignal(signal.id, state.me, new Date()))}>
        {t("doIt")} <ArrowRight size={16} weight="bold" />
      </button>,
      <BinArt />,
    );
  }
  if (meal) {
    return shell(
      "meal",
      meal.cookId === state.me ? t("mealEyebrowMe") : t("mealEyebrowOther", { name: nameOf(meal.cookId) }),
      meal.title,
      recipe && recipe.ingredients.length > 0
        ? t("mealSub", { count: missingIngredients(recipe.ingredients, state.shopping).length })
        : t("mealSubPlain"),
      <Link href="/meer/boodschappen" transitionTypes={["nav-forward"]} className={btn}>
        {t("toShopping")} <ArrowRight size={16} weight="bold" />
      </Link>,
      <PlateArt />,
    );
  }
  return shell(
    "empty",
    t("emptyEyebrow"),
    t("emptyTitle"),
    t("emptySub"),
    <Link href="/meer/boodschappen" transitionTypes={["nav-forward"]} className={btn}>
      {t("planMeal")} <ArrowRight size={16} weight="bold" />
    </Link>,
    <PlateArt />,
  );
}

function Bento({ openCount }: { openCount: number }) {
  const t = useTranslations("today.tiles");
  const { state } = useHousehold();
  const nameOf = useMemberName();
  const now = useNow();
  const today = toDateKey(now);

  // Next weekday with childcare info.
  const wd = now.getDay();
  const careDay = state.care.find((d) => d.weekday === (wd >= 1 && wd <= 5 ? wd : 1))!;
  const careWho = (id: typeof careDay.bring) => (id === "grandma" ? t("grandma") : id === state.me ? t("you") : nameOf(id));
  const careLabel = careDay.atHome
    ? t("careHome", { day: dayShort(careDay.weekday) })
    : t("carePick", { day: dayShort(careDay.weekday), who: careWho(careDay.pick) });

  const nextEvent = state.events
    .filter((e) => new Date(e.start).getTime() >= now.getTime() - 60 * 60000 || e.start.slice(0, 10) >= today)
    .sort((a, b) => a.start.localeCompare(b.start))[0];

  const money = budgetSummary(state.transactions, state.categories, today.slice(0, 7));
  const food = money.lines.find((l) => l.category.id === "food");

  const openProjects = state.projects.filter((p) => p.status !== "done");
  const high = openProjects.filter((p) => p.priority === "high").length;
  const doing = openProjects.find((p) => p.status === "doing");
  const toBuy = state.shopping.filter((s) => !s.checked);

  return (
    <div className="grid grid-cols-2 items-start gap-2.5">
      <div className="flex flex-col gap-2.5">
        <Tile href="/huis" tone="bg-navy text-white" h="h-56" i={0} title={t("household")} sub={t("householdSub", { count: openCount })} subTone="text-[#c9cbd8]">
          <LaundryArt />
        </Tile>
        <Tile href="/kind" tone="bg-tile-child" h="h-44" i={2} title={t("child")} sub={careLabel}>
          <BlocksArt />
        </Tile>
        <Tile href="/meer/agenda" tone="bg-tile-agenda" h="h-44" i={4} title={t("agenda")}
          sub={nextEvent ? `${nextEvent.allDay ? t("allDay") : formatTime(nextEvent.start)} ${nextEvent.title}` : t("agendaEmpty")}>
          <CalendarArt day={now.getDate()} />
        </Tile>
      </div>
      <div className="flex flex-col gap-2.5">
        <Tile href="/geld" tone="bg-tile-money" h="h-44" i={1} title={t("money")}
          sub={food ? (food.category.budgetCents !== null
            ? t("moneySub", { spent: formatEuro(food.spentCents, true), budget: formatEuro(food.category.budgetCents, true) })
            : t("moneySubSpent", { spent: formatEuro(food.spentCents, true) })) : ""}>
          <PiggyArt />
        </Tile>
        <Tile href="/huis?tab=klusjes" tone="bg-tile-jobs" h="h-44" i={3} title={t("projects")}
          sub={doing ? t("projectsSubDoing", { count: openProjects.length, title: doing.title }) : t("projectsSub", { count: openProjects.length })}
          badge={high > 0 ? t("highBadge", { count: high }) : undefined}>
          <ToolboxArt />
        </Tile>
        <Tile href="/meer/boodschappen" tone="bg-tile-food" h="h-56" i={5} title={t("shopping")} sub={t("shoppingSub", { count: toBuy.length })}
          detail={toBuy.length > 0
            ? toBuy.slice(0, 3).map((x) => x.name).join(" · ") + (toBuy.length > 3 ? " " + t("shoppingMore", { count: toBuy.length - 3 }) : "")
            : undefined}>
          <PumpkinArt />
        </Tile>
      </div>
    </div>
  );
}


function Tile({
  href, tone, h, i, title, sub, detail, subTone, badge, children,
}: { href: string; tone: string; h: string; i: number; title: string; sub: string; detail?: string; subTone?: string; badge?: string; children: ReactNode }) {
  return (
    <Link href={href} transitionTypes={["nav-forward"]} style={{ ["--i" as string]: i }}
      className={clsx("press rise relative flex flex-col gap-1 overflow-hidden rounded-[24px] p-4", tone, h)}>
      <span className="relative z-10 max-w-[11ch] text-[15px] font-semibold leading-tight">{title}</span>
      <span className={clsx("relative z-10 text-xs font-medium", subTone ?? "text-ink-2")}>{sub}</span>
      {detail && (
        <span className="relative z-10 mt-1 line-clamp-3 max-w-[15ch] text-[13px] font-medium leading-snug text-ink">{detail}</span>
      )}
      {badge && (
        <span className="absolute right-3.5 top-3.5 z-10 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">{badge}</span>
      )}
      <span className="pointer-events-none absolute -bottom-2 -right-2">{children}</span>
    </Link>
  );
}
