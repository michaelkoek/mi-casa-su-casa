"use client";

import { CaretLeft, CaretRight, Plus, Trash } from "@phosphor-icons/react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { addChore, removeChore, updateChore } from "@/lib/actions";
import { choreRotation, nextAssignee, parseIntervalDays, toDateKey } from "@/lib/logic";
import { useHousehold, useMemberName, useNow } from "@/lib/store";
import type { Chore, MemberId } from "@/lib/types";
import { ChoiceGroup, Field, PrimaryButton, SoftButton, StickyAction } from "../form";
import { PageHeader, Screen } from "../screen";
import { Sheet } from "../sheet";
import { useUI } from "../ui-provider";

/** Cannot clash with a member id: ids never contain "*". */
const ROTATE = "*rotate";

type Preset = "1" | "7" | "14" | "30" | "custom";

export function ChoresScreen() {
  return (
    <Screen>
      <Chores />
    </Screen>
  );
}

function Chores() {
  const t = useTranslations("chores");
  const { state } = useHousehold();
  const nameOf = useMemberName();
  const now = useNow();
  const today = toDateKey(now);
  const [openId, setOpenId] = useState<string | "new" | null>(null);
  // Separate from openId so the sheet keeps its content while it slides away.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const list = [...state.chores].sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const isNew = openId === "new";
  const chore = isNew ? null : (state.chores.find((c) => c.id === openId) ?? null);
  // The other member deleted it: close for good, so an undo on their side doesn't reopen the sheet.
  if (sheetOpen && !isNew && chore === null) setSheetOpen(false);

  const open = (id: string) => {
    setOpenId(id);
    setFormKey((k) => k + 1);
    setSheetOpen(true);
  };

  const dueLabel = (date: string) => {
    if (date < today) return t("overdue");
    if (date === today) return t("dueToday");
    return new Date(`${date}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "long" });
  };

  return (
    <>
      <Link href="/huis" transitionTypes={["nav-back"]} className="press -ml-2 mb-2 inline-flex h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-ink-2">
        <CaretLeft size={18} /> {t("back")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        action={
          <button type="button" aria-label={t("add")} onClick={() => open("new")} className="press grid h-11 w-11 place-items-center rounded-full bg-surface">
            <Plus size={20} weight="bold" />
          </button>
        }
      />

      {list.length === 0 ? (
        <>
          <p className="mt-6 rounded-[22px] bg-surface p-4 text-sm text-ink-2">{t("empty")}</p>
          <SoftButton className="mt-3 w-full" onClick={() => open("new")}>
            <Plus size={18} weight="bold" /> {t("add")}
          </SoftButton>
        </>
      ) : (
        <ul className="mt-6 rounded-[22px] bg-surface px-4">
          {list.map((c) => (
            <li key={c.id} className="border-b border-line last:border-b-0">
              <button type="button" onClick={() => open(c.id)} className="flex min-h-14 w-full items-center gap-3 py-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.title}</span>
                  <span className={clsx("block text-[13px]", c.nextDue < today ? "font-medium text-bad" : "text-ink-3")}>
                    {dueLabel(c.nextDue)} · {t("every", { days: c.intervalDays })}
                  </span>
                </span>
                <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-ink-2">
                  {nextAssignee(c) === state.me ? t("you") : nameOf(nextAssignee(c))}
                </span>
                <CaretRight size={18} className="flex-none text-ink-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ChoreSheet chore={chore} isNew={isNew} open={sheetOpen} formKey={formKey} onClose={() => setSheetOpen(false)} />
    </>
  );
}

function ChoreSheet({ chore, isNew, open, formKey, onClose }: { chore: Chore | null; isNew: boolean; open: boolean; formKey: number; onClose: () => void }) {
  const t = useTranslations("chores");
  const visible = isNew || chore !== null;
  return (
    <Sheet open={open && visible} onClose={onClose} title={isNew ? t("newTitle") : t("editTitle")}>
      {visible && <ChoreForm key={formKey} chore={isNew ? null : chore} onDone={onClose} />}
    </Sheet>
  );
}

function ChoreForm({ chore, onDone }: { chore: Chore | null; onDone: () => void }) {
  const t = useTranslations("chores");
  const { state } = useHousehold();
  const { act } = useUI();
  const multi = state.members.length >= 2;

  const [title, setTitle] = useState(chore?.title ?? "");
  const [preset, setPreset] = useState<Preset>(() => {
    if (!chore) return "7";
    const d = String(chore.intervalDays);
    return d === "1" || d === "7" || d === "14" || d === "30" ? d : "custom";
  });
  const [customDays, setCustomDays] = useState(chore ? String(chore.intervalDays) : "");
  const [who, setWho] = useState<string>(chore ? (chore.rotation.length > 1 ? ROTATE : chore.rotation[0]) : ROTATE);
  const [starter, setStarter] = useState<MemberId>(chore?.rotation[0] ?? state.me);
  const [nextDue, setNextDue] = useState(chore?.nextDue ?? toDateKey(new Date()));
  const [titleError, setTitleError] = useState<string | null>(null);
  const [intervalError, setIntervalError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const memberOptions = state.members.map((m) => ({ value: m.id, label: m.id === state.me ? t("me") : m.name }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setTitleError(t("titleError"));
    const intervalDays = preset === "custom" ? parseIntervalDays(customDays) : Number(preset);
    if (intervalDays === null) return setIntervalError(t("intervalError"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDue)) return setDateError(t("dateError"));
    const ids = state.members.map((m) => m.id);
    const rotation = !multi ? [state.me] : who === ROTATE ? choreRotation(ids, starter, true) : choreRotation(ids, who, false);
    const input = { title, intervalDays, rotation, nextDue };
    onDone();
    if (chore) act(t("updated", { title: title.trim() }), updateChore(chore.id, input));
    else act(t("added", { title: title.trim() }), addChore(input));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("what")} placeholder={t("whatPlaceholder")} maxLength={100} autoFocus={!chore} value={title} error={titleError}
        onChange={(e) => { setTitle(e.target.value); setTitleError(null); }} />
      <ChoiceGroup<Preset> label={t("interval")} value={preset} onChange={(v) => { setPreset(v); setIntervalError(null); }}
        options={[
          { value: "1", label: t("daily") },
          { value: "7", label: t("weekly") },
          { value: "14", label: t("biweekly") },
          { value: "30", label: t("monthly") },
          { value: "custom", label: t("custom") },
        ]} />
      {preset === "custom" && (
        <Field label={t("customDays")} inputMode="numeric" placeholder={t("customPlaceholder")} value={customDays} error={intervalError}
          onChange={(e) => { setCustomDays(e.target.value); setIntervalError(null); }} />
      )}
      {multi && (
        <>
          <ChoiceGroup label={t("who")} value={who} onChange={setWho}
            options={[{ value: ROTATE, label: t("rotate") }, ...memberOptions]} />
          {who === ROTATE && <ChoiceGroup label={t("starts")} value={starter} onChange={setStarter} options={memberOptions} />}
        </>
      )}
      <Field type="date" label={chore ? t("next") : t("first")} value={nextDue} error={dateError}
        onChange={(e) => { setNextDue(e.target.value); setDateError(null); }} />
      <StickyAction>
        <PrimaryButton type="submit">{t("save")}</PrimaryButton>
      </StickyAction>
      {chore && (
        <SoftButton className="w-full text-bad" onClick={() => { onDone(); act(t("removed", { title: chore.title }), removeChore(chore.id)); }}>
          <Trash size={18} /> {t("remove")}
        </SoftButton>
      )}
    </form>
  );
}
