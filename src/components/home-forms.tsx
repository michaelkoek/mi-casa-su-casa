"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import {
  addProject,
  addTask,
  removeMaterial,
  removeProject,
  removeTask,
  renameMaterial,
  updateProject,
  updateTask,
} from "@/lib/actions";
import { addDays, centsToEuroInput, dueFromChoice, parseCostCents, taskDueChoice, toDateKey, type DueChoice } from "@/lib/logic";
import { useHousehold } from "@/lib/store";
import type { HomeProject, HouseholdState, Material, Priority, ProjectKind, Task } from "@/lib/types";
import { ChoiceGroup, Field, FormActions } from "./form";
import { Sheet } from "./sheet";
import { useUI } from "./ui-provider";

export type HomeEditing =
  | { kind: "task"; id: string }
  | { kind: "project"; id: string }
  | { kind: "material"; projectId: string; id: string };

/** The item being edited, or null if it is gone (deleted by the other member). */
export function findHomeItem(state: HouseholdState, editing: HomeEditing | null): Task | HomeProject | Material | null {
  if (!editing) return null;
  if (editing.kind === "task") return state.tasks.find((x) => x.id === editing.id) ?? null;
  if (editing.kind === "project") return state.projects.find((x) => x.id === editing.id) ?? null;
  return state.projects.find((p) => p.id === editing.projectId)?.materials.find((m) => m.id === editing.id) ?? null;
}

/** Edit-only sheet (adding goes through QuickAdd or the inline material field). */
export function HomeSheet({ editing, item, open, formKey, onClose }: {
  editing: HomeEditing | null; item: Task | HomeProject | Material | null; open: boolean; formKey: number; onClose: () => void;
}) {
  const tTask = useTranslations("quick.task");
  const tProject = useTranslations("quick.project");
  const tMaterial = useTranslations("home.projectsView.materialForm");
  const visible = editing !== null && item !== null;
  const title = editing
    ? { task: tTask("editTitle"), project: tProject("editTitle"), material: tMaterial("title") }[editing.kind]
    : "";

  return (
    <Sheet open={open && visible} onClose={onClose} title={title}>
      {visible && editing.kind === "task" && <TaskForm key={formKey} item={item as Task} onDone={onClose} />}
      {visible && editing.kind === "project" && <ProjectForm key={formKey} item={item as HomeProject} onDone={onClose} />}
      {visible && editing.kind === "material" && (
        <MaterialForm key={formKey} projectId={editing.projectId} item={item as Material} onDone={onClose} />
      )}
    </Sheet>
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function TaskForm({ item, onDone }: { item?: Task | null; onDone: () => void }) {
  const t = useTranslations("quick.task");
  const { state } = useHousehold();
  const { act } = useUI();
  const [title, setTitle] = useState(item?.title ?? "");
  const [who, setWho] = useState(item?.assigneeId ?? state.me);
  const [today] = useState(() => toDateKey(new Date()));
  const [choice, setChoice] = useState<DueChoice>(item ? taskDueChoice(item.due, today) : "today");
  const [picked, setPicked] = useState(item?.due ?? addDays(today, 2));
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setTitleError(t("titleError"));
    if (choice === "pick" && !DATE_RE.test(picked)) return setDateError(t("dateError"));
    const due = dueFromChoice(choice, today, picked);
    onDone();
    if (item) {
      // Only patch what changed, so a concurrent edit by the other member isn't overwritten.
      const patch: { title?: string; assigneeId?: string; due?: string | null } = {};
      if (title.trim() !== item.title) patch.title = title;
      if (who !== item.assigneeId) patch.assigneeId = who;
      if (due !== item.due) patch.due = due;
      act(t("updated", { title: title.trim() }), updateTask(item.id, patch));
    } else {
      act(t("saved"), addTask(title.trim(), who, due));
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("what")} placeholder={t("whatPlaceholder")} maxLength={100} value={title} autoFocus={!item} error={titleError}
        onChange={(e) => { setTitle(e.target.value); setTitleError(null); }} />
      <ChoiceGroup label={t("who")} value={who} onChange={setWho}
        options={state.members.map((m) => ({ value: m.id, label: m.id === state.me ? t("me") : m.name }))} />
      <ChoiceGroup label={t("when")} value={choice} onChange={(v) => { setChoice(v); setDateError(null); }}
        options={[
          { value: "today", label: t("today") },
          { value: "tomorrow", label: t("tomorrow") },
          { value: "pick", label: t("pick") },
          { value: "none", label: t("noDate") },
        ]} />
      {choice === "pick" && (
        <Field label={t("date")} type="date" value={picked} error={dateError}
          onChange={(e) => { setPicked(e.target.value); setDateError(null); }} />
      )}
      <FormActions label={item ? t("save") : t("submit")} removeLabel={t("remove")}
        onRemove={item ? () => { onDone(); act(t("removed", { title: item.title }), removeTask(item.id)); } : undefined} />
    </form>
  );
}

export function ProjectForm({ item, onDone }: { item?: HomeProject | null; onDone: () => void }) {
  const t = useTranslations("quick.project");
  const { act } = useUI();
  const [title, setTitle] = useState(item?.title ?? "");
  const [room, setRoom] = useState(item?.room ?? "");
  const [cost, setCost] = useState(item && item.costCents > 0 ? centsToEuroInput(item.costCents) : "");
  const [kind, setKind] = useState<ProjectKind>(item?.kind ?? "finish");
  const [priority, setPriority] = useState<Priority>(item?.priority ?? "medium");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [costError, setCostError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setTitleError(t("titleError"));
    const costCents = parseCostCents(cost);
    if (costCents === null) return setCostError(t("costError"));
    const cleanRoom = room.trim() || t("roomDefault");
    onDone();
    if (item) {
      const patch: { title?: string; room?: string; kind?: ProjectKind; priority?: Priority; costCents?: number } = {};
      if (title.trim() !== item.title) patch.title = title;
      if (cleanRoom !== item.room) patch.room = cleanRoom;
      if (kind !== item.kind) patch.kind = kind;
      if (priority !== item.priority) patch.priority = priority;
      if (costCents !== item.costCents) patch.costCents = costCents;
      act(t("updated", { title: title.trim() }), updateProject(item.id, patch));
    } else {
      act(t("saved"), addProject({ title: title.trim(), room: cleanRoom, kind, priority, costCents }));
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("what")} placeholder={t("whatPlaceholder")} maxLength={100} value={title} autoFocus={!item} error={titleError}
        onChange={(e) => { setTitle(e.target.value); setTitleError(null); }} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("room")} placeholder={t("roomPlaceholder")} maxLength={100} value={room} onChange={(e) => setRoom(e.target.value)} />
        <Field label={t("cost")} inputMode="decimal" placeholder="0" value={cost} error={costError}
          onChange={(e) => { setCost(e.target.value); setCostError(null); }} />
      </div>
      <ChoiceGroup label={t("kind")} value={kind} onChange={setKind}
        options={[{ value: "finish", label: t("finish") }, { value: "maintenance", label: t("maintenance") }]} />
      <ChoiceGroup label={t("priority")} value={priority} onChange={setPriority}
        options={[{ value: "high", label: t("high") }, { value: "medium", label: t("medium") }, { value: "low", label: t("low") }]} />
      <FormActions label={item ? t("save") : t("submit")} removeLabel={t("remove")}
        removeHint={item && item.materials.length > 0 ? t("removeHint", { count: item.materials.length }) : undefined}
        onRemove={item ? () => { onDone(); act(t("removed", { title: item.title }), removeProject(item.id)); } : undefined} />
    </form>
  );
}

export function MaterialForm({ projectId, item, onDone }: { projectId: string; item: Material; onDone: () => void }) {
  const t = useTranslations("home.projectsView.materialForm");
  const { act } = useUI();
  const [name, setName] = useState(item.name);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(t("error"));
    onDone();
    act(t("updated", { name: name.trim() }), renameMaterial(projectId, item.id, name));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("name")} maxLength={100} value={name} error={error}
        onChange={(e) => { setName(e.target.value); setError(null); }} />
      <FormActions label={t("save")} removeLabel={t("remove")}
        onRemove={() => { onDone(); act(t("removed", { name: item.name }), removeMaterial(projectId, item.id)); }} />
    </form>
  );
}
