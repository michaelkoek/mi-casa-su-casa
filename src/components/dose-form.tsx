"use client";

import { Trash, Warning } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { addDose, addMedicine, removeDose, removeMedicine, updateDose, updateMedicine } from "@/lib/actions";
import {
  doseTooEarly,
  formatDuration,
  formatTime,
  fromLocalDateTimeParts,
  lastDoseAmount,
  parseIntervalHours,
  toDateKey,
  toLocalDateTimeParts,
} from "@/lib/logic";
import { useHousehold, useNow } from "@/lib/store";
import type { Dose, Medicine } from "@/lib/types";
import { ChoiceGroup, Field, PrimaryButton, SoftButton, StickyAction } from "./form";
import { useUI } from "./ui-provider";

const MINUTE = 60000;

/** Logs a dose (item null) or edits one. Without medicines it first asks for one. */
export function DoseForm({ item, onDone }: { item?: Dose | null; onDone: () => void }) {
  const t = useTranslations("quick.dose");
  const { state } = useHousehold();
  const { act } = useUI();
  const now = useNow();
  const [medicineId, setMedicineId] = useState(item?.medicineId ?? state.medicines[0]?.id ?? "");
  const [amount, setAmount] = useState(
    () => item?.amount ?? lastDoseAmount(state.doses, state.medicines[0]?.id ?? ""),
  );
  const [edited, setEdited] = useState<{ date: string; time: string } | null>(null);
  // A new dose whose date/time was not touched follows the live clock, so the check and the stored moment are "now".
  const parts = edited ?? toLocalDateTimeParts(item?.at ?? now.toISOString());
  const [lateEarly, setLateEarly] = useState<Date | null>(null);
  const [confirmEarly, setConfirmEarly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const medicine = state.medicines.find((m) => m.id === medicineId) ?? state.medicines[0];
  if (!medicine) {
    return (
      <div className="flex flex-col gap-5">
        <p>{t("noMedicines")}</p>
        <MedicineForm item={null} onDone={() => {}} />
      </div>
    );
  }

  const at = fromLocalDateTimeParts(parts.date, parts.time);
  const liveEarly = at ? doseTooEarly(state.doses, medicine, new Date(at), item?.id) : null;
  const early = liveEarly ?? (confirmEarly ? lateEarly : null);
  const nearNow = at ? Math.abs(new Date(at).getTime() - now.getTime()) <= 5 * MINUTE : false;
  const reset = () => { setConfirmEarly(false); setLateEarly(null); setError(null); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const submitNow = new Date();
    const original = item ? toLocalDateTimeParts(item.at) : null;
    const changed = !!edited && (!original || edited.date !== original.date || edited.time !== original.time);
    const chosen = changed && edited ? fromLocalDateTimeParts(edited.date, edited.time) : item ? item.at : submitNow.toISOString();
    if (!chosen) return setError(t("dateError"));
    if (new Date(chosen).getTime() > submitNow.getTime() + MINUTE) return setError(t("futureError"));
    const found = doseTooEarly(state.doses, medicine, new Date(chosen), item?.id);
    if (found && !confirmEarly) {
      setLateEarly(found);
      return setConfirmEarly(true);
    }
    onDone();
    if (item) {
      const patch = { medicineId: medicine.id, amount, ...(changed ? { at: chosen } : {}) };
      act(t("updated", { name: medicine.name }), updateDose(item.id, patch));
    } else act(t("saved", { name: medicine.name }), addDose(medicine.id, amount.trim(), state.me, new Date(chosen)));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <ChoiceGroup label={t("medicine")} value={medicine.id}
        onChange={(v) => { setMedicineId(v); reset(); }}
        options={state.medicines.map((m) => ({ value: m.id, label: m.name }))} />
      <Field label={t("amount")} placeholder={t("amountPlaceholder")} maxLength={200} value={amount}
        onChange={(e) => setAmount(e.target.value)} hint={t("hint", { hours: medicine.intervalHours })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("date")} type="date" max={toDateKey(now)} value={parts.date}
          onChange={(e) => { setEdited({ ...parts, date: e.target.value }); reset(); }} />
        <Field label={t("time")} type="time" value={parts.time} error={error}
          onChange={(e) => { setEdited({ ...parts, time: e.target.value }); reset(); }} />
      </div>
      {at && early && (
        <div role="alert" className="pop flex gap-3 rounded-2xl bg-accent-soft p-4 text-sm">
          <Warning size={22} className="flex-none text-accent-strong" weight="fill" />
          <p>
            {nearNow
              ? t("tooEarly", { time: formatTime(early), wait: formatDuration(early.getTime() - new Date(at).getTime()) })
              : t("tooEarlyAt", { time: formatTime(early) })}
          </p>
        </div>
      )}
      <StickyAction>
        <PrimaryButton type="submit">{early ? (confirmEarly ? t("confirmEarly") : t("submitEarly")) : t("submit")}</PrimaryButton>
      </StickyAction>
      {item && (
        <SoftButton className="w-full text-bad" onClick={() => { onDone(); act(t("removed", { name: medicine.name }), removeDose(item.id)); }}>
          <Trash size={18} /> {t("remove")}
        </SoftButton>
      )}
    </form>
  );
}

/** Adds or edits a medicine. Deleting also removes its doses. */
export function MedicineForm({ item, onDone }: { item: Medicine | null; onDone: () => void }) {
  const t = useTranslations("child.medicineForm");
  const { state } = useHousehold();
  const { act } = useUI();
  const [name, setName] = useState(item?.name ?? "");
  const [hours, setHours] = useState(String(item?.intervalHours ?? 6));
  const [nameError, setNameError] = useState<string | null>(null);
  const [hoursError, setHoursError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim()) return setNameError(t("nameError"));
    const intervalHours = parseIntervalHours(hours);
    if (intervalHours === null) return setHoursError(t("intervalError"));
    onDone();
    const input = { name, intervalHours };
    if (item) act(t("updated", { name: name.trim() }), updateMedicine(item.id, input));
    else act(t("added", { name: name.trim() }), addMedicine(input));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("name")} placeholder={t("namePlaceholder")} maxLength={100} autoFocus={!item} value={name} error={nameError}
        onChange={(e) => { setName(e.target.value); setNameError(null); }} />
      <Field label={t("interval")} inputMode="numeric" value={hours} error={hoursError}
        onChange={(e) => { setHours(e.target.value); setHoursError(null); }} />
      <StickyAction>
        <PrimaryButton type="submit">{t("save")}</PrimaryButton>
      </StickyAction>
      {item && (
        <div className="flex flex-col gap-2">
          <SoftButton className="w-full text-bad" onClick={() => {
            const count = state.doses.filter((d) => d.medicineId === item.id).length;
            onDone();
            act(t("removed", { name: item.name, count }), removeMedicine(item.id));
          }}>
            <Trash size={18} /> {t("remove")}
          </SoftButton>
          <p className="text-[13px] text-ink-3">{t("removeHint")}</p>
        </div>
      )}
    </form>
  );
}
