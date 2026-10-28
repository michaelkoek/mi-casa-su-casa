"use client";

import { Trash } from "@phosphor-icons/react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { createElement, useState, type FormEvent, type ReactNode } from "react";
import { addSignal, removeSignal, updateSignal } from "@/lib/actions";
import { canAddSignal, cleanSignalLabel, MAX_SIGNAL_LABEL, MAX_SIGNALS } from "@/lib/logic";
import { SIGNAL_PRESETS } from "@/lib/signals";
import { useHousehold } from "@/lib/store";
import { SIGNAL_ICONS, type Signal, type SignalIcon } from "@/lib/types";
import { Field, PrimaryButton, SoftButton, StickyAction } from "./form";
import { Sheet } from "./sheet";
import { signalIconComponent } from "./signal-icons";
import { useUI } from "./ui-provider";

/** Inner content of a signal tile: icon chip on top, label + sub line at the bottom. No container. */
export function SignalFace({ icon, label, sub, open, pop }: { icon: SignalIcon; label: ReactNode; sub: ReactNode; open?: boolean; pop?: boolean }) {
  return (
    <>
      <span key={icon} className={clsx("grid h-10 w-10 place-items-center rounded-[14px] transition-colors duration-300", open ? "bg-white/25" : "bg-bg", pop && "pop")}>
        {createElement(signalIconComponent(icon), { size: 22 })}
      </span>
      <span>
        <span className="block break-words font-semibold">{label}</span>
        <span className={clsx("text-xs", open ? "font-semibold text-[var(--hero-sub)]" : "text-ink-3")}>{sub}</span>
      </span>
    </>
  );
}

export function SignalSheet({ signal, isNew, open, formKey, onClose }: {
  signal: Signal | null; isNew: boolean; open: boolean; formKey: number; onClose: () => void;
}) {
  const t = useTranslations("signals");
  const visible = isNew || signal !== null;
  return (
    <Sheet open={open && visible} onClose={onClose} title={isNew ? t("newTitle") : t("editTitle")}>
      {visible && <SignalForm key={formKey} signal={isNew ? null : signal} onDone={onClose} />}
    </Sheet>
  );
}

const legend = "mb-2 text-[13px] font-semibold text-ink-2";

function SignalForm({ signal, onDone }: { signal: Signal | null; onDone: () => void }) {
  const t = useTranslations("signals");
  const tHome = useTranslations("home");
  const { state } = useHousehold();
  const { act, toast } = useUI();
  const [label, setLabel] = useState(signal?.label ?? "");
  const [icon, setIcon] = useState<SignalIcon>(signal?.icon ?? SIGNAL_ICONS[0]);
  const clean = cleanSignalLabel(label);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!clean) return;
    if (!signal && !canAddSignal(state.signals)) {
      onDone();
      toast(t("full", { max: MAX_SIGNALS }));
      return;
    }
    onDone();
    if (signal) act(t("updated", { label: clean }), updateSignal(signal.id, { label, icon }));
    else act(t("added", { label: clean }), addSignal({ label, icon }));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div aria-hidden="true" className="mx-auto flex min-h-[116px] w-[calc(50%-5px)] flex-col justify-between rounded-[22px] bg-surface p-3.5">
        <SignalFace icon={icon} label={clean || <span className="text-ink-3">{t("previewEmpty")}</span>} sub={tHome("signalTap")} pop />
      </div>
      {!signal && (
        <fieldset className="flex flex-col gap-2">
          <legend className={legend}>{t("presets")}</legend>
          <div className="flex flex-wrap gap-2">
            {SIGNAL_PRESETS.map((p) => {
              const text = t(`preset.${p.key}`);
              const on = label === text && icon === p.icon;
              return (
                <button key={p.key} type="button" aria-pressed={on} onClick={() => { setLabel(text); setIcon(p.icon); }}
                  className={clsx("press inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors duration-200",
                    on ? "bg-ink text-bg" : "bg-surface text-ink-2")}>
                  {createElement(signalIconComponent(p.icon), { size: 18 })} {text}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <Field label={t("name")} placeholder={t("namePlaceholder")} maxLength={MAX_SIGNAL_LABEL} value={label}
        onChange={(e) => setLabel(e.target.value)} />
      <fieldset className="flex flex-col gap-2">
        <legend className={legend}>{t("icon")}</legend>
        <div className="grid grid-cols-6 gap-2">
          {SIGNAL_ICONS.map((id) => (
            <button key={id} type="button" aria-pressed={icon === id} aria-label={t(`icons.${id}`)} onClick={() => setIcon(id)}
              className={clsx("press grid aspect-square min-h-12 place-items-center rounded-2xl transition-colors duration-200",
                icon === id ? "bg-accent-soft text-accent-strong ring-2 ring-accent-strong" : "bg-surface text-ink-2")}>
              {createElement(signalIconComponent(id), { size: 22 })}
            </button>
          ))}
        </div>
      </fieldset>
      <StickyAction>
        <PrimaryButton type="submit" disabled={!clean}>{t("save")}</PrimaryButton>
      </StickyAction>
      {signal && (
        <SoftButton className="w-full text-bad" onClick={() => { onDone(); act(t("removed", { label: signal.label }), removeSignal(signal.id)); }}>
          <Trash size={18} /> {t("remove")}
        </SoftButton>
      )}
    </form>
  );
}
