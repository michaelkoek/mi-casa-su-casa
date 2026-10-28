"use client";

import { Basket, CaretDown, CaretRight, ForkKnife, Newspaper, Plus, Trash, WashingMachine, Wine, Baby } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  addMaterial,
  doneChore,
  materialsToShopping,
  setProjectStatus,
  toggleMaterial,
  toggleSignal,
  toggleTask,
} from "@/lib/actions";
import { choresDueWithin, formatEuro, minutesAgo, nextAssignee, toDateKey, weekdayName } from "@/lib/logic";
import { useHousehold, useMemberName, useNow } from "@/lib/store";
import type { HomeProject, ProjectStatus, SignalIcon } from "@/lib/types";
import { Checkbox, SoftButton } from "../form";
import { PageHeader, Screen, SectionTitle } from "../screen";
import { useUI } from "../ui-provider";

const SIGNAL_ICONS: Record<SignalIcon, typeof Trash> = {
  trash: Trash,
  paper: Newspaper,
  laundry: WashingMachine,
  dishwasher: ForkKnife,
  diaper: Baby,
  glass: Wine,
};

export function HomeScreen() {
  return (
    <Screen>
      <Home />
    </Screen>
  );
}

function Home() {
  const t = useTranslations("home");
  const params = useSearchParams();
  const [tab, setTab] = useState<"household" | "projects">(params.get("tab") === "klusjes" ? "projects" : "household");

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <div role="tablist" className="relative mt-[18px] grid grid-cols-2 rounded-2xl bg-surface p-1">
        <motion.div
          aria-hidden="true"
          className="absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-xl bg-bg shadow-card"
          animate={{ x: tab === "projects" ? "100%" : "0%" }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
        />
        {(["household", "projects"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={clsx("relative h-10 text-sm font-semibold transition-colors duration-200", tab === v ? "text-ink" : "text-ink-3")}>
            {t(v)}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
          {tab === "household" ? <Household /> : <Projects />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function Household() {
  const t = useTranslations("home");
  const { state } = useHousehold();
  const nameOf = useMemberName();
  const now = useNow();
  const { act } = useUI();
  const [pulse, setPulse] = useState<string | null>(null);
  const today = toDateKey(now);
  const chores = choresDueWithin(state.chores, today, 7);
  const openTasks = state.tasks.filter((x) => !x.doneAt).sort((a, b) => (a.due ?? "9").localeCompare(b.due ?? "9"));

  const dueLabel = (date: string) => {
    if (date < today) return t("overdue");
    if (date === today) return t("dueToday");
    const d = new Date(date + "T12:00:00");
    return weekdayName(d.getDay(), "long");
  };

  return (
    <>
      <SectionTitle aside={t("signalsHint")}>{t("signals")}</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {state.signals.map((s, i) => {
          const Icon = SIGNAL_ICONS[s.icon];
          const open = !!s.openedAt;
          return (
            <button key={s.id} type="button" aria-pressed={open} style={{ ["--i" as string]: i }}
              onClick={() => {
                setPulse(s.id);
                window.setTimeout(() => setPulse((p) => (p === s.id ? null : p)), 360);
                act(open ? t("signalClosed", { label: s.label }) : t("signalSent", { name: otherName(state, nameOf) }),
                  toggleSignal(s.id, state.me, new Date()));
              }}
              className={clsx(
                "rise flex min-h-[116px] flex-col justify-between rounded-[22px] p-3.5 text-left transition-colors duration-300 active:scale-[0.97]",
                open ? "bg-hero text-white" : "bg-surface",
                pulse === s.id && "pulse-once",
              )}>
              <span className={clsx("grid h-10 w-10 place-items-center rounded-[14px] transition-colors duration-300", open ? "bg-white/25" : "bg-bg")}>
                <Icon size={22} />
              </span>
              <span>
                <span className="block font-semibold">{s.label}</span>
                <span className={clsx("text-xs", open ? "font-semibold text-[var(--hero-sub)]" : "text-ink-3")}>
                  {open
                    ? t("signalOpen", { name: s.openedBy === state.me ? t("you") : nameOf(s.openedBy), minutes: minutesAgo(s.openedAt!, now) })
                    : t("signalTap")}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <SectionTitle aside={t("choresHint")}>{t("chores")}</SectionTitle>
      <div className="rounded-[22px] bg-surface px-4 py-1">
        {chores.length === 0 && (
          <p className="border-b border-line py-5 text-center text-ink-3">
            {state.chores.length === 0 ? t("choresEmpty") : t("choresNone")}
          </p>
        )}
        {chores.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.title}</p>
              <p className={clsx("text-[13px]", c.nextDue < today ? "font-medium text-bad" : "text-ink-3")}>
                {dueLabel(c.nextDue)} · {t("every", { days: c.intervalDays })}
              </p>
            </div>
            <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-ink-2">
              {nextAssignee(c) === state.me ? t("you") : nameOf(nextAssignee(c))}
            </span>
            <button type="button" className="press h-11 rounded-xl px-3 text-sm font-semibold text-accent-strong"
              onClick={() => act(t("choreDone", { title: c.title, next: nameOf(c.rotation[1] ?? c.rotation[0]) }), doneChore(c.id, new Date()))}>
              {t("done")}
            </button>
          </div>
        ))}
        <Link href="/huis/vaste-taken" transitionTypes={["nav-forward"]}
          className="press flex min-h-12 items-center justify-between py-3 text-sm font-semibold text-ink-2">
          {state.chores.length === 0 ? t("choresAdd") : t("choresAll", { count: state.chores.length })}
          <CaretRight size={18} className="text-ink-3" />
        </Link>
      </div>

      <SectionTitle aside={t("tasksCount", { count: openTasks.length })}>{t("tasks")}</SectionTitle>
      <div className="rounded-[22px] bg-surface px-4 py-1">
        {openTasks.length === 0 && <p className="py-5 text-center text-ink-3">{t("noTasks")}</p>}
        <AnimatePresence initial={false}>
          {openTasks.map((task) => (
            <motion.button layout key={task.id} type="button" exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.22 }}
              className="flex min-h-14 w-full items-center gap-3 border-b border-line py-3 text-left last:border-b-0"
              onClick={() => act(t("taskDone"), toggleTask(task.id, new Date()))}>
              <Checkbox done={false} />
              <span className="min-w-0 flex-1">{task.title}</span>
              <span className="whitespace-nowrap text-xs text-ink-3">
                {task.assigneeId === state.me ? t("you") : nameOf(task.assigneeId)}
                {task.due ? ` · ${dueLabel(task.due)}` : ""}
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

function otherName(state: { me: string; members: { id: string; name: string }[] }, nameOf: (id: string) => string) {
  const other = state.members.find((m) => m.id !== state.me);
  return other ? nameOf(other.id) : "";
}

const STATUS_ORDER: ProjectStatus[] = ["doing", "todo", "done"];

function Projects() {
  const t = useTranslations("home.projectsView");
  const { state } = useHousehold();
  const { openSheet } = useUI();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = state.projects.filter((p) => p.status !== "done");
  const total = open.reduce((s, p) => s + p.costCents, 0);
  const sorted = [...state.projects].sort((a, b) => {
    const s = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (s !== 0) return s;
    const pr = { high: 0, medium: 1, low: 2 };
    return pr[a.priority] - pr[b.priority];
  });

  return (
    <>
      <SectionTitle aside={formatEuro(total, true)}>{t("open", { count: open.length })}</SectionTitle>
      <div className="flex flex-col gap-2">
        {sorted.map((p) => (
          <ProjectCard key={p.id} project={p} expanded={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} />
        ))}
      </div>
      <SoftButton className="mt-3 w-full" onClick={() => openSheet("project")}>
        <Plus size={18} weight="bold" /> {t("add")}
      </SoftButton>
    </>
  );
}

function ProjectCard({ project: p, expanded, onToggle }: { project: HomeProject; expanded: boolean; onToggle: () => void }) {
  const t = useTranslations("home.projectsView");
  const { update } = useHousehold();
  const { act, toast } = useUI();
  const [material, setMaterial] = useState("");
  const bought = p.materials.filter((m) => m.bought).length;

  const addMat = (e: FormEvent) => {
    e.preventDefault();
    if (!material.trim()) return;
    update(addMaterial(p.id, material.trim()));
    setMaterial("");
  };

  const priorityTone = { high: "bg-accent-soft text-accent-strong", medium: "bg-bg text-ink-2", low: "bg-bg text-ink-3" }[p.priority];

  return (
    <motion.div layout transition={{ type: "spring", stiffness: 420, damping: 40 }}
      className={clsx("overflow-hidden rounded-[22px]", p.status === "done" ? "bg-surface/60" : "bg-surface")}>
      <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <p className={clsx("font-semibold", p.status === "done" && "text-ink-3 line-through")}>{p.title}</p>
          <p className="text-[13px] text-ink-3">
            {p.room} · {t(p.kind)} · {formatEuro(p.costCents, true)}
          </p>
        </div>
        {p.status === "doing" ? (
          <span className="rounded-full bg-tile-agenda px-2.5 py-1 text-xs font-semibold text-[#2c6a47] dark:text-[#8fd3a8]">{t("doing")}</span>
        ) : p.status === "todo" ? (
          <span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold", priorityTone)}>{t(p.priority)}</span>
        ) : (
          <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-ink-3">{t("done")}</span>
        )}
        <CaretDown size={18} className={clsx("text-ink-3 transition-transform duration-300", expanded && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }} className="px-4">
            <div className="flex gap-2 pb-3">
              {(["todo", "doing", "done"] as const).map((s) => (
                <button key={s} type="button" aria-pressed={p.status === s}
                  onClick={() => act(t("statusSaved", { status: t(`status.${s}`) }), setProjectStatus(p.id, s))}
                  className={clsx("press h-9 rounded-full px-3.5 text-[13px] font-medium",
                    p.status === s ? "bg-ink text-bg" : "bg-bg text-ink-2")}>
                  {t(`status.${s}`)}
                </button>
              ))}
            </div>
            <p className="pb-1 text-[13px] font-semibold text-ink-3">{t("materials", { bought, total: p.materials.length })}</p>
            {p.materials.map((m) => (
              <button key={m.id} type="button" onClick={() => update(toggleMaterial(p.id, m.id))}
                className="flex min-h-11 w-full items-center gap-3 text-left">
                <Checkbox done={m.bought} />
                <span className={clsx(m.bought && "text-ink-3 line-through")}>{m.name}</span>
              </button>
            ))}
            <form onSubmit={addMat} className="mt-1 flex gap-2">
              <label className="sr-only" htmlFor={`mat-${p.id}`}>{t("addMaterial")}</label>
              <input id={`mat-${p.id}`} value={material} onChange={(e) => setMaterial(e.target.value)} placeholder={t("addMaterial")}
                className="h-11 min-w-0 flex-1 rounded-xl bg-bg px-3 text-[15px] outline-none ring-accent-strong focus:ring-2" />
              <button type="submit" aria-label={t("addMaterial")} className="press grid h-11 w-11 place-items-center rounded-xl bg-bg">
                <Plus size={18} weight="bold" />
              </button>
            </form>
            {p.materials.some((m) => !m.bought) && (
              <button type="button" className="press my-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent-soft text-sm font-semibold text-accent-strong"
                onClick={() => { update(materialsToShopping(p.id)); toast(t("toShoppingDone")); }}>
                <Basket size={18} /> {t("toShopping")}
              </button>
            )}
            {!p.materials.some((m) => !m.bought) && <div className="h-3" />}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
