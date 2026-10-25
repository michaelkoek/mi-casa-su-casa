"use client";

import clsx from "clsx";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export function Field({
  label,
  error,
  hint,
  ...input
}: { label: string; error?: string | null; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={clsx(
          "h-12 rounded-2xl bg-surface px-4 text-base outline-none ring-accent-strong transition-shadow placeholder:text-ink-3 focus:ring-2",
          error && "ring-2 ring-bad",
        )}
        {...input}
      />
      {(error || hint) && (
        <p id={`${id}-msg`} className={clsx("text-[13px]", error ? "text-bad" : "text-ink-3")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-semibold text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={clsx(
              "press h-10 rounded-full px-4 text-sm font-medium transition-colors duration-200",
              o.value === value ? "bg-ink text-bg" : "bg-surface text-ink-2",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function PrimaryButton({ children, ...rest }: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={clsx(
        "press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent-strong font-semibold text-white disabled:opacity-40",
        rest.className,
      )}
    >
      {children}
    </button>
  );
}

export function SoftButton({ children, ...rest }: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={clsx("press flex h-12 items-center justify-center gap-2 rounded-2xl bg-surface px-4 font-semibold", rest.className)}
    >
      {children}
    </button>
  );
}

export function Checkbox({ done }: { done: boolean }) {
  return (
    <span
      className={clsx(
        "tick grid h-[26px] w-[26px] flex-none place-items-center rounded-[9px] border-[1.6px] text-white transition-colors duration-200",
        done ? "on border-accent bg-accent" : "border-ink-3",
      )}
      aria-hidden="true"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.2 4.2L19 7" />
      </svg>
    </span>
  );
}
