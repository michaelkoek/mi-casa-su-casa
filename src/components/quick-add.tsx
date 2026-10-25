"use client";

import { CheckSquare, Hammer, Pill, Wallet, Warning } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { addDose, addExpense, addProject, addTask } from "@/lib/actions";
import { addDays, formatDuration, formatTime, nextDoseAllowedAt, parseEuroToCents, toDateKey } from "@/lib/logic";
import { useHousehold } from "@/lib/store";
import type { Priority, ProjectKind } from "@/lib/types";
import { ChoiceGroup, Field, PrimaryButton } from "./form";
import { Sheet } from "./sheet";
import { useUI, type SheetKind } from "./ui-provider";

/** The "+" sheet and the four quick forms it leads to. */
export function QuickAdd() {
  const t = useTranslations("quick");
  const { sheet, openSheet, closeSheet } = useUI();

  const titles: Record<SheetKind, string> = {
    quick: t("title"),
    expense: t("expense.title"),
    task: t("task.title"),
    project: t("project.title"),
    dose: t("dose.title"),
  };

  return (
    <Sheet open={sheet !== null} onClose={closeSheet} title={sheet ? titles[sheet] : ""}>
      {sheet === "quick" && (
        <div className="grid grid-cols-2 gap-2.5">
          <QuickTile tone="bg-tile-money" Icon={Wallet} title={t("expense.tile")} sub={t("expense.sub")} onClick={() => openSheet("expense")} i={0} />
          <QuickTile tone="bg-navy text-white" Icon={CheckSquare} title={t("task.tile")} sub={t("task.sub")} onClick={() => openSheet("task")} i={1} dark />
          <QuickTile tone="bg-tile-jobs" Icon={Hammer} title={t("project.tile")} sub={t("project.sub")} onClick={() => openSheet("project")} i={2} />
          <QuickTile tone="bg-tile-child" Icon={Pill} title={t("dose.tile")} sub={t("dose.sub")} onClick={() => openSheet("dose")} i={3} />
        </div>
      )}
      {sheet === "expense" && <ExpenseForm />}
      {sheet === "task" && <TaskForm />}
      {sheet === "project" && <ProjectForm />}
      {sheet === "dose" && <DoseForm />}
    </Sheet>
  );
}

function QuickTile({
  tone, Icon, title, sub, onClick, i, dark,
}: { tone: string; Icon: typeof Wallet; title: string; sub: string; onClick: () => void; i: number; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ["--i" as string]: i }}
      className={`press rise flex min-h-[108px] flex-col justify-between rounded-[22px] p-4 text-left ${tone}`}
    >
      <Icon size={28} />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className={`text-[13px] ${dark ? "text-[#c9cbd8]" : "text-ink-2"}`}>{sub}</span>
      </span>
    </button>
  );
}

function ExpenseForm() {
  const t = useTranslations("quick.expense");
  const { state } = useHousehold();
  const { act, closeSheet } = useUI();
  const [amount, setAmount] = useState("");
  const [what, setWhat] = useState("");
  const [category, setCategory] = useState(state.categories[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseEuroToCents(amount);
    if (!cents) return setError(t("amountError"));
    closeSheet();
    act(t("saved"), addExpense(cents, what.trim() || t("defaultName"), category, new Date()));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("amount")} inputMode="decimal" placeholder="12,50" value={amount} autoFocus error={error}
        onChange={(e) => { setAmount(e.target.value); setError(null); }} />
      <Field label={t("what")} placeholder={t("whatPlaceholder")} value={what} onChange={(e) => setWhat(e.target.value)} />
      <ChoiceGroup label={t("category")} value={category} onChange={setCategory}
        options={state.categories.map((c) => ({ value: c.id, label: c.name }))} />
      <PrimaryButton type="submit">{t("submit")}</PrimaryButton>
    </form>
  );
}

function TaskForm() {
  const t = useTranslations("quick.task");
  const { state } = useHousehold();
  const { act, closeSheet } = useUI();
  const [title, setTitle] = useState("");
  const [who, setWho] = useState(state.me);
  const [when, setWhen] = useState<"today" | "tomorrow" | "none">("today");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError(t("titleError"));
    const today = toDateKey(new Date());
    const due = when === "today" ? today : when === "tomorrow" ? addDays(today, 1) : null;
    closeSheet();
    act(t("saved"), addTask(title.trim(), who, due));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("what")} placeholder={t("whatPlaceholder")} value={title} autoFocus error={error}
        onChange={(e) => { setTitle(e.target.value); setError(null); }} />
      <ChoiceGroup label={t("who")} value={who} onChange={setWho}
        options={state.members.map((m) => ({ value: m.id, label: m.id === state.me ? t("me") : m.name }))} />
      <ChoiceGroup label={t("when")} value={when} onChange={setWhen}
        options={[{ value: "today", label: t("today") }, { value: "tomorrow", label: t("tomorrow") }, { value: "none", label: t("noDate") }]} />
      <PrimaryButton type="submit">{t("submit")}</PrimaryButton>
    </form>
  );
}

function ProjectForm() {
  const t = useTranslations("quick.project");
  const { act, closeSheet } = useUI();
  const [title, setTitle] = useState("");
  const [room, setRoom] = useState("");
  const [cost, setCost] = useState("");
  const [kind, setKind] = useState<ProjectKind>("finish");
  const [priority, setPriority] = useState<Priority>("medium");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError(t("titleError"));
    closeSheet();
    act(t("saved"), addProject({
      title: title.trim(), room: room.trim() || t("roomDefault"), kind, priority, costCents: parseEuroToCents(cost) ?? 0,
    }));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("what")} placeholder={t("whatPlaceholder")} value={title} autoFocus error={error}
        onChange={(e) => { setTitle(e.target.value); setError(null); }} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("room")} placeholder={t("roomPlaceholder")} value={room} onChange={(e) => setRoom(e.target.value)} />
        <Field label={t("cost")} inputMode="decimal" placeholder="0" value={cost} onChange={(e) => setCost(e.target.value)} />
      </div>
      <ChoiceGroup label={t("kind")} value={kind} onChange={setKind}
        options={[{ value: "finish", label: t("finish") }, { value: "maintenance", label: t("maintenance") }]} />
      <ChoiceGroup label={t("priority")} value={priority} onChange={setPriority}
        options={[{ value: "high", label: t("high") }, { value: "medium", label: t("medium") }, { value: "low", label: t("low") }]} />
      <PrimaryButton type="submit">{t("submit")}</PrimaryButton>
    </form>
  );
}

export function DoseForm({ presetMedicine }: { presetMedicine?: string }) {
  const t = useTranslations("quick.dose");
  const { state } = useHousehold();
  const { act, closeSheet } = useUI();
  const [medicineId, setMedicineId] = useState(presetMedicine ?? state.medicines[0].id);
  const lastAmount = [...state.doses].reverse().find((d) => d.medicineId === medicineId)?.amount ?? "";
  const [amount, setAmount] = useState(lastAmount);
  const [confirmEarly, setConfirmEarly] = useState(false);

  const medicine = state.medicines.find((m) => m.id === medicineId)!;
  const next = nextDoseAllowedAt(state.doses, medicine);
  const now = new Date();
  const tooEarly = next !== null && next.getTime() > now.getTime();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (tooEarly && !confirmEarly) return setConfirmEarly(true);
    closeSheet();
    act(t("saved", { name: medicine.name }), addDose(medicineId, amount.trim(), state.me, new Date()));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <ChoiceGroup label={t("medicine")} value={medicineId}
        onChange={(v) => { setMedicineId(v); setConfirmEarly(false); }}
        options={state.medicines.map((m) => ({ value: m.id, label: m.name }))} />
      <Field label={t("amount")} placeholder={t("amountPlaceholder")} value={amount} onChange={(e) => setAmount(e.target.value)}
        hint={t("hint", { hours: medicine.intervalHours })} />
      {tooEarly && (
        <div role="alert" className="pop flex gap-3 rounded-2xl bg-accent-soft p-4 text-sm">
          <Warning size={22} className="flex-none text-accent-strong" weight="fill" />
          <p>
            {t("tooEarly", { time: formatTime(next!), wait: formatDuration(next!.getTime() - now.getTime()) })}
          </p>
        </div>
      )}
      <PrimaryButton type="submit">{tooEarly ? (confirmEarly ? t("confirmEarly") : t("submitEarly")) : t("submit")}</PrimaryButton>
    </form>
  );
}
