"use client";

import { CheckSquare, Hammer, Pill, Wallet } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { addExpense } from "@/lib/actions";
import { parseEuroToCents } from "@/lib/logic";
import { useHousehold } from "@/lib/store";
import { DoseForm } from "./dose-form";
import { ChoiceGroup, Field, PrimaryButton } from "./form";
import { ProjectForm, TaskForm } from "./home-forms";
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
      {sheet === "task" && <TaskForm onDone={closeSheet} />}
      {sheet === "project" && <ProjectForm onDone={closeSheet} />}
      {sheet === "dose" && <DoseForm onDone={closeSheet} />}
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
    const categoryId = state.categories.some((c) => c.id === category) ? category : null;
    closeSheet();
    act(t("saved"), addExpense(cents, what.trim() || t("defaultName"), categoryId, new Date()));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("amount")} inputMode="decimal" placeholder="12,50" value={amount} autoFocus error={error}
        onChange={(e) => { setAmount(e.target.value); setError(null); }} />
      <Field label={t("what")} placeholder={t("whatPlaceholder")} value={what} onChange={(e) => setWhat(e.target.value)} />
      {state.categories.length > 0 && (
        <ChoiceGroup label={t("category")} value={category} onChange={setCategory}
          options={state.categories.map((c) => ({ value: c.id, label: c.name }))} />
      )}
      <PrimaryButton type="submit">{t("submit")}</PrimaryButton>
    </form>
  );
}
