"use client";

import { CalendarBlank, CaretDown, CaretRight, Check, MapPin, PencilSimple, Plus, Thermometer, Trash } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { claimCare, cycleFood, cycleStock, removeAppointment, setHomeDay } from "@/lib/actions";
import { doseProgress, formatDuration, formatTime, nextDoseAllowedAt, weekdayName } from "@/lib/logic";
import { useHousehold, useMemberName, useNow } from "@/lib/store";
import type { CareDay, CareSlot, FoodVerdict } from "@/lib/types";
import { ChildSheet, findChildItem, type ChildEditing, type ChildKind } from "../child-forms";
import { SoftButton } from "../form";
import { PageHeader, Screen, SectionTitle } from "../screen";
import { useUI } from "../ui-provider";

const DAY = 86400000;
type Weekday = CareDay["weekday"];
type OnOpen = (kind: ChildKind, id: string | "new") => void;

export function ChildScreen() {
  return (
    <Screen>
      <Child />
    </Screen>
  );
}

/** Today if it is a weekday, otherwise Monday. */
function defaultWeekday(now: Date): Weekday {
  const d = now.getDay();
  return (d >= 1 && d <= 5 ? d : 1) as Weekday;
}

function Child() {
  const t = useTranslations("child");
  const { state } = useHousehold();
  const [editing, setEditing] = useState<ChildEditing | null>(null);
  // Separate from editing so the sheet keeps its content while it slides away.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const item = findChildItem(state, editing);
  // The other member deleted it: close for good, so an undo on their side doesn't reopen the sheet.
  if (sheetOpen && editing && editing.id !== "new" && item === null) setSheetOpen(false);

  const open: OnOpen = (kind, id) => {
    setEditing({ kind, id });
    setFormKey((k) => k + 1);
    setSheetOpen(true);
  };

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <Care />
      <Appointments onOpen={open} />
      <Routine onOpen={open} />
      <SizesAndStock onOpen={open} />
      <Growth onOpen={open} />
      <Foods onOpen={open} />
      <Milestones onOpen={open} />
      <Medicine onOpen={open} />

      <ChildSheet editing={editing} item={item} open={sheetOpen} formKey={formKey} onClose={() => setSheetOpen(false)} />
    </>
  );
}

/* ---------- Opvang: wie brengt, wie haalt op ---------- */

function Care() {
  const t = useTranslations("child.care");
  const { state } = useHousehold();
  const nameOf = useMemberName();
  const now = useNow();
  const { act } = useUI();
  const [selected, setSelected] = useState<Weekday>(() => defaultWeekday(now));
  const day = state.care.find((d) => d.weekday === selected)!;
  const todayWd = now.getDay();

  const who = (slot: CareSlot) =>
    slot === "grandma" ? t("grandma") : slot === state.me ? t("you") : slot ? nameOf(slot) : t("nobody");

  const row = (field: "bring" | "pick") => {
    const slot = day[field];
    const mine = slot === state.me;
    return (
      <div className="flex items-center gap-3 border-b border-white/10 py-3 last:border-b-0">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#c9cbd8]">{field === "bring" ? t("bring") : t("pick")}</p>
          <p className="text-lg font-semibold">{who(slot)}</p>
        </div>
        {mine ? (
          <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-semibold">
            <Check size={16} weight="bold" /> {t("yours")}
          </span>
        ) : (
          <button type="button"
            onClick={() => act(t(field === "bring" ? "claimedBring" : "claimedPick", { day: weekdayName(selected, "long") }),
              claimCare(selected, field, state.me))}
            className="press h-11 rounded-full bg-white px-4 text-sm font-semibold text-accent-strong">
            {field === "bring" ? t("iBring") : t("iPick")}
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <SectionTitle aside={t("hint")}>{t("title")}</SectionTitle>
      <div className="grid grid-cols-5 gap-1.5">
        {state.care.map((d, i) => (
          <button key={d.weekday} type="button" aria-pressed={selected === d.weekday} onClick={() => setSelected(d.weekday)}
            style={{ ["--i" as string]: i }}
            className={clsx("press rise flex flex-col items-center gap-0.5 rounded-2xl py-2.5 text-center transition-colors duration-200",
              selected === d.weekday ? "bg-navy text-white" : "bg-surface")}>
            <span className={clsx("text-xs font-semibold", selected === d.weekday ? "text-white" : "text-ink-2")}>
              {weekdayName(d.weekday)}{d.weekday === todayWd ? " ·" : ""}
            </span>
            <span className={clsx("text-[11px]", selected === d.weekday ? "text-[#c9cbd8]" : "text-ink-3")}>
              {d.atHome ? t("homeShort") : t("careShort")}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={selected + String(day.atHome)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="mt-2.5 rounded-[24px] bg-navy px-4 pb-2 pt-4 text-white">
          <div className="flex items-center justify-between">
            <p className="font-semibold capitalize">{weekdayName(selected, "long")}</p>
            <button type="button" onClick={() => act(day.atHome ? t("toCare") : t("toHome"), setHomeDay(selected, !day.atHome))}
              className="press h-9 rounded-full bg-white/10 px-3 text-xs font-semibold">
              {day.atHome ? t("makeCareDay") : t("makeHomeDay")}
            </button>
          </div>
          {day.atHome ? (
            <p className="py-5 text-[#c9cbd8]">{t("homeDay")}</p>
          ) : (
            <>
              {row("bring")}
              {row("pick")}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

/* ---------- Afspraken ---------- */

function Appointments({ onOpen }: { onOpen: OnOpen }) {
  const t = useTranslations("child");
  const { state } = useHousehold();
  const now = useNow();
  const { act } = useUI();
  const upcoming = state.appointments.filter((a) => new Date(a.at).getTime() > now.getTime() - 2 * 3600000);
  return (
    <>
      <SectionTitle>{t("appointments")}</SectionTitle>
      <div className="rounded-[22px] bg-surface px-4 py-1">
        {upcoming.length === 0 && <p className="py-4 text-sm text-ink-3">{t("noAppointments")}</p>}
        <AnimatePresence initial={false}>
          {upcoming.map((a) => (
            <motion.div key={a.id} layout exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.22 }}
              className="flex items-center gap-3 border-b border-line last:border-b-0">
              <button type="button" onClick={() => onOpen("appointment", a.id)}
                className="press flex min-h-11 min-w-0 flex-1 items-center gap-3 py-3 text-left">
                <CalendarBlank size={22} className="flex-none text-ink-3" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{a.title}</span>
                  <span className="block text-[13px] text-ink-3">
                    {new Date(a.at).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "short" })} · {formatTime(a.at)}
                    {a.place && <span className="inline-flex items-center gap-0.5"> · <MapPin size={12} /> {a.place}</span>}
                  </span>
                </span>
              </button>
              <button type="button" aria-label={t("removeAppointment", { title: a.title })}
                onClick={() => act(t("appointmentRemoved"), removeAppointment(a.id))}
                className="press grid h-11 w-11 place-items-center rounded-xl text-ink-3">
                <Trash size={18} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <SoftButton className="mt-2.5 w-full" onClick={() => onOpen("appointment", "new")}><Plus size={18} weight="bold" /> {t("addAppointment")}</SoftButton>
    </>
  );
}

/* ---------- Dagritme ---------- */

function Routine({ onOpen }: { onOpen: OnOpen }) {
  const t = useTranslations("child");
  const { state } = useHousehold();
  const now = useNow();
  const nowHm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const list = [...state.routine].sort((a, b) => a.time.localeCompare(b.time));
  const nextItem = list.find((x) => x.time > nowHm);
  return (
    <>
      <SectionTitle aside={t("routineHint")}>{t("routine")}</SectionTitle>
      <div className="rounded-[22px] bg-surface px-4 py-1">
        {list.length === 0 && <p className="py-4 text-sm text-ink-3">{t("noRoutine")}</p>}
        {list.map((r) => (
          <button key={r.id} type="button" onClick={() => onOpen("routine", r.id)}
            className="press flex min-h-14 w-full items-center gap-3 border-b border-line py-3 text-left last:border-b-0">
            <span className="num w-12 text-[13px] text-ink-3">{r.time}</span>
            <span className={clsx(nextItem?.id === r.id && "font-semibold")}>{r.label}</span>
            {nextItem?.id === r.id && (
              <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">{t("next")}</span>
            )}
            <CaretRight size={16} className={clsx("flex-none text-ink-3", nextItem?.id !== r.id && "ml-auto")} />
          </button>
        ))}
      </div>
      <SoftButton className="mt-2.5 w-full" onClick={() => onOpen("routine", "new")}><Plus size={18} weight="bold" /> {t("addRoutine")}</SoftButton>
    </>
  );
}

/* ---------- Kledingmaat en voorraad ---------- */

function SizesAndStock({ onOpen }: { onOpen: OnOpen }) {
  const t = useTranslations("child");
  const { state } = useHousehold();
  const { act } = useUI();
  const [editMode, setEditMode] = useState(false);
  const levelTone = { full: "bg-tile-agenda", half: "bg-tile-food", low: "bg-accent-soft" } as const;
  const editing = editMode && state.stock.length > 0;
  if (editMode && state.stock.length === 0) setEditMode(false);
  return (
    <>
      <SectionTitle aside={t("sizesHint")}>{t("sizes")}</SectionTitle>
      {state.sizes.length === 0 && <p className="rounded-[22px] bg-surface p-4 text-sm text-ink-3">{t("noSizes")}</p>}
      <div className="grid grid-cols-2 gap-2.5">
        {state.sizes.map((z, i) => (
          <button key={z.id} type="button" onClick={() => onOpen("size", z.id)} style={{ ["--i" as string]: i }}
            className="press rise flex min-h-[92px] flex-col justify-between rounded-[22px] bg-tile-money p-3.5 text-left">
            <span className="text-xs font-semibold text-ink-2">{z.label}</span>
            <span>
              <span className="num block text-2xl font-bold tracking-tight">{z.size}</span>
              {z.note && <span className="text-xs text-ink-2">{z.note}</span>}
            </span>
          </button>
        ))}
      </div>
      <SoftButton className="mt-2.5 w-full" onClick={() => onOpen("size", "new")}><Plus size={18} weight="bold" /> {t("addSize")}</SoftButton>

      <SectionTitle aside={editing ? t("stockEditHint") : t("stockHint")}>{t("stock")}</SectionTitle>
      <div className="flex flex-col gap-2">
        {state.stock.length === 0 && <p className="rounded-[22px] bg-surface p-4 text-sm text-ink-3">{t("noStock")}</p>}
        {state.stock.map((s) => (
          <button key={s.id} type="button"
            onClick={() => editing
              ? onOpen("stock", s.id)
              : act(s.level === "half" ? t("stockLowAdded", { name: s.name }) : t("stockUpdated", { name: s.name }), cycleStock(s.id))}
            className={clsx("press flex min-h-14 items-center gap-3 rounded-2xl px-4 text-left transition-colors duration-300", levelTone[s.level])}>
            <span className="flex-1 font-medium">{s.name}</span>
            <span className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((n) => (
                <span key={n} className={clsx("h-2 w-5 rounded-full transition-colors duration-300",
                  n < { full: 3, half: 2, low: 1 }[s.level] ? (s.level === "low" ? "bg-accent" : "bg-ink") : "bg-bg")} />
              ))}
            </span>
            <span className={clsx("w-16 text-right text-xs font-semibold", s.level === "low" ? "text-accent-strong" : "text-ink-2")}>
              {t(`level.${s.level}`)}
            </span>
            {editing && <PencilSimple size={16} className="flex-none text-ink-3" />}
          </button>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <SoftButton onClick={() => onOpen("stock", "new")}><Plus size={18} weight="bold" /> {t("addStock")}</SoftButton>
        {state.stock.length > 0 && (
          <SoftButton aria-pressed={editMode} onClick={() => setEditMode(!editMode)}
            className={clsx(editMode && "bg-ink text-bg")}>
            {editMode ? <Check size={18} weight="bold" /> : <PencilSimple size={18} />} {editMode ? t("done") : t("edit")}
          </SoftButton>
        )}
      </div>
    </>
  );
}

/* ---------- Groei ---------- */

function Growth({ onOpen }: { onOpen: OnOpen }) {
  const t = useTranslations("child");
  const { state } = useHousehold();
  const list = [...state.growth].sort((a, b) => b.date.localeCompare(a.date));
  const [last, prev] = list;
  const kg = (g: number) => (g / 1000).toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const shortDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  return (
    <>
      <SectionTitle aside={last ? shortDate(last.date) : undefined}>
        {t("growth")}
      </SectionTitle>
      {last ? (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-[22px] bg-surface p-4">
            <p className="text-xs font-semibold text-ink-3">{t("weight")}</p>
            <p className="num mt-1 text-2xl font-bold">{kg(last.weightGrams)} kg</p>
            {prev && <p className="num text-xs text-ink-3">{t("delta", { value: `+${kg(last.weightGrams - prev.weightGrams)} kg` })}</p>}
          </div>
          <div className="rounded-[22px] bg-surface p-4">
            <p className="text-xs font-semibold text-ink-3">{t("length")}</p>
            <p className="num mt-1 text-2xl font-bold">{last.lengthCm.toLocaleString("nl-NL")} cm</p>
            {prev && <p className="num text-xs text-ink-3">{t("delta", { value: `+${(last.lengthCm - prev.lengthCm).toLocaleString("nl-NL")} cm` })}</p>}
          </div>
        </div>
      ) : (
        <p className="rounded-[22px] bg-surface p-4 text-sm text-ink-3">{t("noGrowth")}</p>
      )}
      {list.length > 0 && (
        <div className="mt-2.5 rounded-[22px] bg-surface px-4 py-1">
          {list.map((g) => (
            <button key={g.id} type="button" onClick={() => onOpen("growth", g.id)}
              className="press flex min-h-11 w-full items-center gap-3 border-b border-line py-2 text-left last:border-b-0">
              <span className="w-14 flex-none text-[13px] text-ink-3">{shortDate(g.date)}</span>
              <span className="num flex-1 text-sm">{kg(g.weightGrams)} kg · {g.lengthCm.toLocaleString("nl-NL")} cm</span>
              <CaretRight size={16} className="flex-none text-ink-3" />
            </button>
          ))}
        </div>
      )}
      <SoftButton className="mt-2.5 w-full" onClick={() => onOpen("growth", "new")}><Plus size={18} weight="bold" /> {t("addGrowth")}</SoftButton>
    </>
  );
}

/* ---------- Eten: nieuwe producten ---------- */

function Foods({ onOpen }: { onOpen: OnOpen }) {
  const t = useTranslations("child");
  const { state, update } = useHousehold();
  const [editMode, setEditMode] = useState(false);
  const tone: Record<FoodVerdict, string> = { likes: "bg-tile-agenda", dislikes: "bg-tile-child", unsure: "bg-surface" };
  const editing = editMode && state.foods.length > 0;
  if (editMode && state.foods.length === 0) setEditMode(false);
  return (
    <>
      <SectionTitle aside={editing ? t("foodsEditHint") : t("foodsHint")}>{t("foods")}</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {state.foods.map((f) => (
          <button key={f.id} type="button" onClick={() => (editing ? onOpen("food", f.id) : update(cycleFood(f.id)))}
            className={clsx("press inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm transition-colors duration-300", tone[f.verdict])}>
            <span className="font-medium">{f.name}</span>
            <span className="text-xs text-ink-2">{t(`verdict.${f.verdict}`)}</span>
            {editing && <PencilSimple size={14} className="text-ink-3" />}
          </button>
        ))}
        <button type="button" onClick={() => onOpen("food", "new")} aria-label={t("addFood")}
          className="press inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed border-ink-3 px-4 text-sm text-ink-2">
          <Plus size={16} /> {t("addFood")}
        </button>
        {state.foods.length > 0 && (
          <button type="button" aria-pressed={editMode} onClick={() => setEditMode(!editMode)}
            className={clsx("press inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium",
              editMode ? "bg-ink text-bg" : "bg-surface")}>
            {editMode ? <Check size={16} weight="bold" /> : <PencilSimple size={16} />} {editMode ? t("done") : t("edit")}
          </button>
        )}
      </div>
    </>
  );
}

/* ---------- Mijlpalen ---------- */

function Milestones({ onOpen }: { onOpen: OnOpen }) {
  const t = useTranslations("child");
  const { state } = useHousehold();
  const list = [...state.milestones].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <SectionTitle>{t("milestones")}</SectionTitle>
      <div className="rounded-[22px] bg-tile-food px-4 py-1">
        {list.length === 0 && <p className="py-4 text-sm text-ink-2">{t("noMilestones")}</p>}
        {list.map((m) => (
          <button key={m.id} type="button" onClick={() => onOpen("milestone", m.id)}
            className="press flex min-h-11 w-full gap-3 border-b border-line/60 py-3 text-left last:border-b-0">
            <span className="w-14 flex-none text-[13px] text-ink-2">
              {new Date(m.date + "T12:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
            </span>
            <span>{m.text}</span>
          </button>
        ))}
      </div>
      <SoftButton className="mt-2.5 w-full" onClick={() => onOpen("milestone", "new")}><Plus size={18} weight="bold" /> {t("addMilestone")}</SoftButton>
    </>
  );
}

/* ---------- Medicijnen en koorts (compact, alleen als het speelt) ---------- */

function Medicine({ onOpen }: { onOpen: OnOpen }) {
  const t = useTranslations("child");
  const { state } = useHousehold();
  const nameOf = useMemberName();
  const now = useNow();
  const { openSheet } = useUI();
  const [open, setOpen] = useState(false);
  const recent = state.doses.filter((d) => now.getTime() - new Date(d.at).getTime() < DAY);
  const active = state.medicines.filter((m) => recent.some((d) => d.medicineId === m.id));
  const temps = state.temperatures.filter((x) => now.getTime() - new Date(x.at).getTime() < DAY).sort((a, b) => b.at.localeCompare(a.at));
  const summary = active.length
    ? active.map((m) => {
        const next = nextDoseAllowedAt(state.doses, m)!;
        return next.getTime() > now.getTime() ? t("medSummaryWait", { name: m.name, time: formatTime(next) }) : t("medSummaryReady", { name: m.name });
      }).join(" · ")
    : t("medSummaryNone");

  return (
    <div className="mt-7 rounded-[22px] bg-surface">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
        <Thermometer size={20} className="flex-none text-ink-3" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t("medicine")}</span>
          <span className="block truncate text-xs text-ink-3">{summary}</span>
        </span>
        <CaretDown size={16} className={clsx("text-ink-3 transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden px-4">
            {active.map((m) => {
              const next = nextDoseAllowedAt(state.doses, m)!;
              const last = [...state.doses].filter((d) => d.medicineId === m.id).sort((a, b) => b.at.localeCompare(a.at))[0];
              const waiting = next.getTime() > now.getTime();
              const progress = doseProgress(state.doses, m, now);
              const doses = recent.filter((d) => d.medicineId === m.id).sort((a, b) => b.at.localeCompare(a.at));
              return (
                <div key={m.id} className="mb-2">
                  <div className="flex items-center gap-3 rounded-2xl bg-bg p-3">
                    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="flex-none">
                      <circle cx="20" cy="20" r="16" fill="none" strokeWidth="5" stroke="var(--surface)" />
                      <circle cx="20" cy="20" r="16" fill="none" strokeWidth="5" strokeLinecap="round" stroke="var(--accent)"
                        strokeDasharray={100.5} strokeDashoffset={100.5 * (1 - progress)} transform="rotate(-90 20 20)" />
                    </svg>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold">{m.name} {last.amount} · {formatTime(last.at)}</p>
                      <p className="text-xs text-ink-3">
                        {waiting ? t("nextDose", { time: formatTime(next), wait: formatDuration(next.getTime() - now.getTime()) }) : t("doseAllowed")}
                        {" · "}{t("givenBy", { name: last.by === state.me ? t("you") : nameOf(last.by) })}
                      </p>
                    </div>
                  </div>
                  {doses.map((d) => (
                    <button key={d.id} type="button" onClick={() => onOpen("dose", d.id)}
                      className="press flex min-h-11 w-full items-center gap-2 px-3 text-left text-[13px] text-ink-2">
                      <span className="num min-w-0 flex-1 truncate">
                        {formatTime(d.at)} · {d.amount} · {d.by === state.me ? t("you") : nameOf(d.by)}
                      </span>
                      <CaretRight size={14} className="flex-none text-ink-3" />
                    </button>
                  ))}
                </div>
              );
            })}
            {temps.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {temps.map((x) => (
                  <button key={x.id} type="button" onClick={() => onOpen("temp", x.id)}
                    className={clsx("press num h-11 rounded-full px-3 text-xs font-medium", x.celsius >= 38 ? "bg-accent-soft text-accent-strong" : "bg-bg text-ink-2")}>
                    {formatTime(x.at)} · {x.celsius.toLocaleString("nl-NL", { minimumFractionDigits: 1 })} °C
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <SoftButton className="bg-bg" onClick={() => openSheet("dose")}>{t("giveDose")}</SoftButton>
              <SoftButton className="bg-bg" onClick={() => onOpen("temp", "new")}>{t("temperature")}</SoftButton>
            </div>
            <p className="mb-1 mt-4 text-[13px] font-semibold text-ink-2">{t("manageMedicines")}</p>
            {state.medicines.length === 0 && <p className="py-2 text-sm text-ink-3">{t("noMedicines")}</p>}
            {state.medicines.map((m) => (
              <button key={m.id} type="button" onClick={() => onOpen("medicine", m.id)}
                className="press flex min-h-11 w-full items-center gap-2 text-left text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
                <span className="text-xs text-ink-3">{t("medicineInterval", { hours: m.intervalHours })}</span>
                <CaretRight size={14} className="flex-none text-ink-3" />
              </button>
            ))}
            <SoftButton className="mb-3 mt-2 w-full bg-bg" onClick={() => onOpen("medicine", "new")}>
              <Plus size={18} weight="bold" /> {t("addMedicine")}
            </SoftButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
