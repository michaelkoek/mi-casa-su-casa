"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import {
  addFood,
  addGrowth,
  addMilestone,
  addRoutine,
  addAppointment,
  addSize,
  addStock,
  addTemperature,
  removeAppointment,
  removeFood,
  removeGrowth,
  removeMilestone,
  removeRoutine,
  removeSize,
  removeStock,
  removeTemperature,
  renameStock,
  updateAppointment,
  updateFood,
  updateGrowth,
  updateMilestone,
  updateRoutine,
  updateSize,
  updateTemperature,
} from "@/lib/actions";
import { fromLocalDateTimeParts, toDateKey, toLocalDateTimeParts } from "@/lib/logic";
import type {
  Appointment,
  ClothingSize,
  Dose,
  FoodTry,
  FoodVerdict,
  GrowthEntry,
  HouseholdState,
  Medicine,
  Milestone,
  RoutineItem,
  StockItem,
  Temperature,
} from "@/lib/types";
import { DoseForm, MedicineForm } from "./dose-form";
import { ChoiceGroup, Field, FormActions } from "./form";
import { Sheet } from "./sheet";
import { useUI } from "./ui-provider";

const DAY = 86400000;

export type ChildKind = "dose" | "temp" | "appointment" | "milestone" | "growth" | "food" | "routine" | "medicine" | "size" | "stock";
export type ChildEditing = { kind: ChildKind; id: string | "new" };
type ChildItem = Dose | Temperature | Appointment | Milestone | GrowthEntry | FoodTry | RoutineItem | Medicine | ClothingSize | StockItem;

/** Looks up the item in its collection; null for "new" or a missing item. */
export function findChildItem(state: HouseholdState, editing: ChildEditing | null): ChildItem | null {
  if (!editing || editing.id === "new") return null;
  const lists: Record<ChildKind, { id: string }[]> = {
    dose: state.doses,
    temp: state.temperatures,
    appointment: state.appointments,
    milestone: state.milestones,
    growth: state.growth,
    food: state.foods,
    routine: state.routine,
    medicine: state.medicines,
    size: state.sizes,
    stock: state.stock,
  };
  return (lists[editing.kind].find((x) => x.id === editing.id) as ChildItem | undefined) ?? null;
}

export function ChildSheet({ editing, item, open, formKey, onClose }: {
  editing: ChildEditing | null; item: ChildItem | null; open: boolean; formKey: number; onClose: () => void;
}) {
  const t = useTranslations("child");
  const tDose = useTranslations("quick.dose");
  const isNew = editing?.id === "new";
  const visible = editing !== null && (isNew || item !== null);

  const titles: Record<ChildKind, [string, string]> = {
    dose: [tDose("title"), tDose("editTitle")],
    temp: [t("tempForm.newTitle"), t("tempForm.editTitle")],
    appointment: [t("appointmentForm.title"), t("appointmentForm.editTitle")],
    milestone: [t("milestoneForm.title"), t("milestoneForm.editTitle")],
    growth: [t("growthForm.title"), t("growthForm.editTitle")],
    food: [t("foodForm.title"), t("foodForm.editTitle")],
    routine: [t("routineForm.newTitle"), t("routineForm.editTitle")],
    medicine: [t("medicineForm.newTitle"), t("medicineForm.editTitle")],
    size: [t("sizeForm.newTitle"), t("sizeForm.editTitle")],
    stock: [t("stockForm.newTitle"), t("stockForm.editTitle")],
  };
  const title = editing ? titles[editing.kind][isNew ? 0 : 1] : "";
  const pick = <T,>() => (isNew ? null : (item as T));

  return (
    <Sheet open={open && visible} onClose={onClose} title={title}>
      {visible && editing.kind === "dose" && <DoseForm key={formKey} item={pick<Dose>()} onDone={onClose} />}
      {visible && editing.kind === "temp" && <TempForm key={formKey} item={pick<Temperature>()} onDone={onClose} />}
      {visible && editing.kind === "appointment" && <AppointmentForm key={formKey} item={pick<Appointment>()} onDone={onClose} />}
      {visible && editing.kind === "milestone" && <MilestoneForm key={formKey} item={pick<Milestone>()} onDone={onClose} />}
      {visible && editing.kind === "growth" && <GrowthForm key={formKey} item={pick<GrowthEntry>()} onDone={onClose} />}
      {visible && editing.kind === "food" && <FoodForm key={formKey} item={pick<FoodTry>()} onDone={onClose} />}
      {visible && editing.kind === "routine" && <RoutineForm key={formKey} item={pick<RoutineItem>()} onDone={onClose} />}
      {visible && editing.kind === "medicine" && <MedicineForm key={formKey} item={pick<Medicine>()} onDone={onClose} />}
      {visible && editing.kind === "size" && <SizeForm key={formKey} item={pick<ClothingSize>()} onDone={onClose} />}
      {visible && editing.kind === "stock" && <StockForm key={formKey} item={pick<StockItem>()} onDone={onClose} />}
    </Sheet>
  );
}

const kgText = (g: number) => String(g / 1000).replace(".", ",");
const numText = (n: number) => String(n).replace(".", ",");

export function TempForm({ item, onDone }: { item: Temperature | null; onDone: () => void }) {
  const t = useTranslations("child.tempForm");
  const { act } = useUI();
  const [value, setValue] = useState(item ? numText(item.celsius) : "");
  const [parts, setParts] = useState(() => toLocalDateTimeParts(item?.at ?? new Date().toISOString()));
  const [error, setError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = parseFloat(value.replace(",", "."));
    if (!(c >= 34 && c <= 43)) return setError(t("error"));
    const submitNow = new Date();
    const original = item ? toLocalDateTimeParts(item.at) : null;
    const changed = !original || original.date !== parts.date || original.time !== parts.time;
    const at = changed ? fromLocalDateTimeParts(parts.date, parts.time) : item!.at;
    if (!at) return setTimeError(t("dateError"));
    if (new Date(at).getTime() > submitNow.getTime() + 60000) return setTimeError(t("futureError"));
    onDone();
    if (item) act(t("updated"), updateTemperature(item.id, { celsius: c, ...(changed ? { at } : {}) }));
    else act(t("saved", { value: c.toLocaleString("nl-NL") }), addTemperature(c, new Date(at)));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("label")} inputMode="decimal" placeholder="37,8" autoFocus={!item} value={value} error={error}
        onChange={(e) => { setValue(e.target.value); setError(null); }} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("date")} type="date" max={toDateKey(new Date())} value={parts.date}
          onChange={(e) => { setParts({ ...parts, date: e.target.value }); setTimeError(null); }} />
        <Field label={t("time")} type="time" value={parts.time} error={timeError}
          onChange={(e) => { setParts({ ...parts, time: e.target.value }); setTimeError(null); }} />
      </div>
      <FormActions label={t("submit")} removeLabel={t("remove")}
        onRemove={item ? () => { onDone(); act(t("removed"), removeTemperature(item.id)); } : undefined} />
    </form>
  );
}

export function AppointmentForm({ item, onDone }: { item: Appointment | null; onDone: () => void }) {
  const t = useTranslations("child.appointmentForm");
  const { act } = useUI();
  const [title, setTitle] = useState(item?.title ?? "");
  const [parts, setParts] = useState(() =>
    item ? toLocalDateTimeParts(item.at) : { date: toDateKey(new Date(Date.now() + DAY)), time: "09:00" });
  const [place, setPlace] = useState(item?.place ?? "");
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError(t("titleError"));
    const at = fromLocalDateTimeParts(parts.date, parts.time);
    if (!at) return setDateError(t("dateError"));
    onDone();
    if (item) act(t("updated"), updateAppointment(item.id, { title, at, place: place.trim() || null }));
    else act(t("saved"), addAppointment(title.trim(), at, place.trim() || null));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("what")} placeholder={t("whatPlaceholder")} maxLength={100} autoFocus={!item} value={title} error={error}
        onChange={(e) => { setTitle(e.target.value); setError(null); }} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("date")} type="date" value={parts.date} error={dateError}
          onChange={(e) => { setParts({ ...parts, date: e.target.value }); setDateError(null); }} />
        <Field label={t("time")} type="time" value={parts.time}
          onChange={(e) => { setParts({ ...parts, time: e.target.value }); setDateError(null); }} />
      </div>
      <Field label={t("place")} placeholder={t("placePlaceholder")} maxLength={200} value={place} onChange={(e) => setPlace(e.target.value)} />
      <FormActions label={item ? t("save") : t("submit")} removeLabel={t("remove")}
        onRemove={item ? () => { onDone(); act(t("removed"), removeAppointment(item.id)); } : undefined} />
    </form>
  );
}

export function MilestoneForm({ item, onDone }: { item: Milestone | null; onDone: () => void }) {
  const t = useTranslations("child.milestoneForm");
  const { act } = useUI();
  const [text, setText] = useState(item?.text ?? "");
  const [date, setDate] = useState(item?.date ?? toDateKey(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return setError(t("error"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > toDateKey(new Date())) return setDateError(t("dateError"));
    onDone();
    if (item) act(t("updated"), updateMilestone(item.id, { text, date }));
    else act(t("saved"), addMilestone(text.trim(), date));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("label")} placeholder={t("placeholder")} maxLength={500} autoFocus={!item} value={text} error={error}
        onChange={(e) => { setText(e.target.value); setError(null); }} />
      <Field label={t("date")} type="date" max={toDateKey(new Date())} value={date} error={dateError}
        onChange={(e) => { setDate(e.target.value); setDateError(null); }} />
      <FormActions label={item ? t("save") : t("submit")} removeLabel={t("remove")}
        onRemove={item ? () => { onDone(); act(t("removed"), removeMilestone(item.id)); } : undefined} />
    </form>
  );
}

export function GrowthForm({ item, onDone }: { item: GrowthEntry | null; onDone: () => void }) {
  const t = useTranslations("child.growthForm");
  const { act } = useUI();
  const [weight, setWeight] = useState(item ? kgText(item.weightGrams) : "");
  const [length, setLength] = useState(item ? numText(item.lengthCm) : "");
  const [date, setDate] = useState(item?.date ?? toDateKey(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const kg = parseFloat(weight.replace(",", "."));
    const cm = parseFloat(length.replace(",", "."));
    if (!(kg > 1 && kg < 40) || !(cm > 30 && cm < 150)) return setError(t("error"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > toDateKey(new Date())) return setDateError(t("dateError"));
    onDone();
    const grams = Math.round(kg * 1000);
    if (item) act(t("updated"), updateGrowth(item.id, { weightGrams: grams, lengthCm: cm, date }));
    else act(t("saved"), addGrowth(grams, cm, date));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("weight")} inputMode="decimal" placeholder="9,8" autoFocus={!item} value={weight}
          onChange={(e) => { setWeight(e.target.value); setError(null); }} />
        <Field label={t("length")} inputMode="decimal" placeholder="77" value={length}
          onChange={(e) => { setLength(e.target.value); setError(null); }} />
      </div>
      {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
      <Field label={t("date")} type="date" max={toDateKey(new Date())} value={date} error={dateError}
        onChange={(e) => { setDate(e.target.value); setDateError(null); }} />
      <FormActions label={item ? t("save") : t("submit")} removeLabel={t("remove")}
        onRemove={item ? () => { onDone(); act(t("removed"), removeGrowth(item.id)); } : undefined} />
    </form>
  );
}

export function FoodForm({ item, onDone }: { item: FoodTry | null; onDone: () => void }) {
  const t = useTranslations("child.foodForm");
  const tv = useTranslations("child.verdict");
  const { act } = useUI();
  const [name, setName] = useState(item?.name ?? "");
  const [verdict, setVerdict] = useState<FoodVerdict>(item?.verdict ?? "unsure");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t("error"));
    onDone();
    if (item) act(t("updated", { name: name.trim() }), updateFood(item.id, { name, verdict }));
    else act(t("saved"), addFood(name.trim(), toDateKey(new Date()), verdict));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("label")} placeholder={t("placeholder")} maxLength={100} autoFocus={!item} value={name} error={error}
        onChange={(e) => { setName(e.target.value); setError(null); }} />
      <ChoiceGroup label={t("verdict")} value={verdict} onChange={setVerdict}
        options={(["likes", "unsure", "dislikes"] as const).map((v) => ({ value: v, label: tv(v) }))} />
      <FormActions label={item ? t("save") : t("submit")} removeLabel={t("remove")}
        onRemove={item ? () => { onDone(); act(t("removed", { name: item.name }), removeFood(item.id)); } : undefined} />
    </form>
  );
}

export function RoutineForm({ item, onDone }: { item: RoutineItem | null; onDone: () => void }) {
  const t = useTranslations("child.routineForm");
  const { act } = useUI();
  const [time, setTime] = useState(item?.time ?? "12:00");
  const [label, setLabel] = useState(item?.label ?? "");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return setTimeError(t("timeError"));
    if (!label.trim()) return setLabelError(t("labelError"));
    onDone();
    if (item) act(t("updated", { label: label.trim() }), updateRoutine(item.id, { time, label }));
    else act(t("added", { label: label.trim(), time }), addRoutine({ time, label }));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("time")} type="time" value={time} error={timeError}
        onChange={(e) => { setTime(e.target.value); setTimeError(null); }} />
      <Field label={t("label")} placeholder={t("placeholder")} maxLength={100} autoFocus={!item} value={label} error={labelError}
        onChange={(e) => { setLabel(e.target.value); setLabelError(null); }} />
      <FormActions label={t("save")} removeLabel={t("remove")}
        onRemove={item ? () => { onDone(); act(t("removed", { label: item.label }), removeRoutine(item.id)); } : undefined} />
    </form>
  );
}

export function SizeForm({ item, onDone }: { item: ClothingSize | null; onDone: () => void }) {
  const t = useTranslations("child.sizeForm");
  const { act } = useUI();
  const [label, setLabel] = useState(item?.label ?? "");
  const [size, setSize] = useState(item?.size ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [labelError, setLabelError] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return setLabelError(t("labelError"));
    if (!size.trim()) return setSizeError(t("sizeError"));
    onDone();
    const input = { label, size, note: note.trim() || null };
    if (item) act(t("saved", { label: label.trim(), size: size.trim() }), updateSize(item.id, input));
    else act(t("added", { label: label.trim() }), addSize(input));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("label")} placeholder={t("labelPlaceholder")} maxLength={100} autoFocus={!item} value={label} error={labelError}
        onChange={(e) => { setLabel(e.target.value); setLabelError(null); }} />
      <Field label={t("size")} maxLength={40} value={size} error={sizeError}
        onChange={(e) => { setSize(e.target.value); setSizeError(null); }} />
      <Field label={t("note")} placeholder={t("notePlaceholder")} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      <FormActions label={t("submit")} removeLabel={t("remove")}
        onRemove={item ? () => { onDone(); act(t("removed", { label: item.label }), removeSize(item.id)); } : undefined} />
    </form>
  );
}

export function StockForm({ item, onDone }: { item: StockItem | null; onDone: () => void }) {
  const t = useTranslations("child.stockForm");
  const { act } = useUI();
  const [name, setName] = useState(item?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t("error"));
    onDone();
    if (item) act(t("updated", { name: name.trim() }), renameStock(item.id, name));
    else act(t("added", { name: name.trim() }), addStock(name));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("name")} placeholder={t("placeholder")} maxLength={100} autoFocus={!item} value={name} error={error}
        onChange={(e) => { setName(e.target.value); setError(null); }} />
      <FormActions label={t("save")} removeLabel={t("remove")}
        onRemove={item ? () => { onDone(); act(t("removed", { name: item.name }), removeStock(item.id)); } : undefined} />
    </form>
  );
}
