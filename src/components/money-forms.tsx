"use client";

import { ArrowsLeftRight } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { addCategory, removeCategory, removeRule, removeTransaction, updateCategory, updateRule, updateTransaction } from "@/lib/actions";
import { shopName } from "@/lib/insights";
import { MAX_CENTS, centsToEuroInput, formatEuro, parseEuroToCents, parseOptionalCents, toDateKey } from "@/lib/logic";
import { useHousehold } from "@/lib/store";
import type { Category, CategoryRule, Transaction } from "@/lib/types";
import { ChoiceGroup, Checkbox, Field, FormActions } from "./form";
import { useUI } from "./ui-provider";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type TxPatch = Partial<{ amountCents: number; date: string; counterparty: string; categoryId: string | null; transfer: boolean }>;

/** One form, one Save, for manual and bank rows. Bank rows only edit name, category and transfer; the server enforces it too. */
export function TransactionForm({ item, account, onDone }: { item: Transaction; account?: string; onDone: () => void }) {
  const t = useTranslations("transactions");
  const { state } = useHousehold();
  const { act } = useUI();
  // Patch only what changed since the form opened (snapshot), so the other member's concurrent edits to other fields survive.
  const [original] = useState(item);
  const manual = original.source === "manual";
  const [today] = useState(() => toDateKey(new Date()));
  const [amount, setAmount] = useState(centsToEuroInput(Math.abs(original.amountCents)));
  const [date, setDate] = useState(original.date);
  const [name, setName] = useState(original.counterparty);
  const [category, setCategory] = useState<string | null>(original.categoryId);
  const [transfer, setTransfer] = useState(original.transfer);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; amount?: string; date?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const next: typeof errors = {};
    if (!cleanName) next.name = t("nameError");
    let cents = 0;
    if (manual) {
      const parsed = parseEuroToCents(amount);
      if (parsed === null || parsed > MAX_CENTS) next.amount = t("amountError");
      else cents = parsed;
      if (!DATE_RE.test(date) || date > today) next.date = t("dateError");
    }
    if (next.name || next.amount || next.date) return setErrors(next);

    const patch: TxPatch = {};
    if (manual) {
      if (-cents !== original.amountCents) patch.amountCents = cents;
      if (date !== original.date) patch.date = date;
    }
    if (cleanName !== original.counterparty) patch.counterparty = cleanName;
    // A category deleted meanwhile counts as unchanged.
    const stale = category !== null && !state.categories.some((c) => c.id === category);
    if (!transfer && !stale && category !== original.categoryId) patch.categoryId = category;
    if (transfer !== original.transfer) patch.transfer = transfer;

    const keys = Object.keys(patch);
    onDone();
    if (keys.length === 0) return;
    const categoryName = state.categories.find((c) => c.id === category)?.name ?? "";
    const msg =
      keys.length === 1 && keys[0] === "categoryId"
        ? t("categorized", { name: cleanName, category: categoryName })
        : keys.length === 1 && keys[0] === "transfer"
          ? t(transfer ? "transferOn" : "transferOff", { name: cleanName })
          : t("updated", { name: cleanName });
    act(msg, updateTransaction(original.id, patch, remember && patch.categoryId !== undefined));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {manual ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("amount")} inputMode="decimal" value={amount} error={errors.amount}
            onChange={(e) => { setAmount(e.target.value); setErrors((x) => ({ ...x, amount: undefined })); }} />
          <Field label={t("date")} type="date" max={today} value={date} error={errors.date}
            onChange={(e) => { setDate(e.target.value); setErrors((x) => ({ ...x, date: undefined })); }} />
        </div>
      ) : (
        <div>
          <p className="text-[13px] text-ink-3 first-letter:uppercase">
            {new Date(`${original.date}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <p className={`num mt-1 text-3xl font-bold tracking-tight ${transfer ? "opacity-50" : ""}`}>
            {original.amountCents > 0 ? `+ ${formatEuro(original.amountCents)}` : formatEuro(original.amountCents)}
          </p>
          <p className="mt-1 text-[13px] text-ink-3">{t("bankHint")}</p>
        </div>
      )}

      <Field label={t("name")} maxLength={200} value={name} error={errors.name}
        onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }} />

      {(original.description || account) && (
        <dl className="rounded-[22px] bg-surface px-4 py-1 text-sm">
          {original.description && (
            <div className="border-b border-line py-3 last:border-b-0">
              <dt className="text-[13px] text-ink-3">{t("details")}</dt>
              <dd className="mt-0.5 break-words">{original.description}</dd>
            </div>
          )}
          {account && (
            <div className="border-b border-line py-3 last:border-b-0">
              <dt className="text-[13px] text-ink-3">{t("account")}</dt>
              <dd className="mt-0.5">{account}</dd>
            </div>
          )}
        </dl>
      )}

      {!transfer && state.categories.length > 0 && (
        <div>
          <ChoiceGroup label={t("category")} value={category ?? ""} onChange={setCategory}
            options={state.categories.map((c) => ({ value: c.id, label: c.name }))} />
          <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-ink-2">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-[var(--accent-strong)]" />
            {t("remember", { name: shopName(original.counterparty) })}
          </label>
        </div>
      )}

      <button type="button" role="switch" aria-checked={transfer} onClick={() => setTransfer((v) => !v)}
        className="press flex w-full items-center gap-3 rounded-[22px] bg-surface p-4 text-left">
        <ArrowsLeftRight size={20} className="flex-none" />
        <span className="flex-1">
          <span className="block font-medium">{t("markTransfer")}</span>
          <span className="block text-[13px] text-ink-3">{t("markTransferSub")}</span>
        </span>
        <Checkbox done={transfer} />
      </button>

      <FormActions label={t("save")} removeLabel={t("remove")}
        onRemove={manual ? () => { onDone(); act(t("removed", { name: original.counterparty }), removeTransaction(original.id)); } : undefined} />
    </form>
  );
}

/** Add (item null) or edit a category: name and optional monthly budget; deleting cascades to transactions and rules. */
export function CategoryForm({ item, spentCents, onDone }: { item: Category | null; spentCents: number; onDone: () => void }) {
  const t = useTranslations("money.category");
  const tBudget = useTranslations("money.budget");
  const { state } = useHousehold();
  const { act } = useUI();
  const [original] = useState(item);
  const [name, setName] = useState(original?.name ?? "");
  const [budget, setBudget] = useState(original?.budgetCents == null ? "" : centsToEuroInput(original.budgetCents));
  const [nameError, setNameError] = useState<string | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim().slice(0, 40);
    if (!cleanName) return setNameError(t("nameError"));
    const parsed = parseOptionalCents(budget);
    if (!parsed.ok) return setBudgetError(t("budgetError"));
    if (!original) {
      onDone();
      act(t("added", { name: cleanName }), addCategory(cleanName, parsed.cents));
      return;
    }
    const patch: Partial<{ name: string; budgetCents: number | null }> = {};
    if (cleanName !== original.name) patch.name = cleanName;
    if (parsed.cents !== original.budgetCents) patch.budgetCents = parsed.cents;
    const keys = Object.keys(patch);
    onDone();
    if (keys.length === 0) return;
    const msg =
      keys.length === 1 && keys[0] === "budgetCents"
        ? parsed.cents !== null
          ? tBudget("saved", { category: cleanName, amount: formatEuro(parsed.cents, true) })
          : tBudget("cleared", { category: cleanName })
        : t("updated", { name: cleanName });
    act(msg, updateCategory(original.id, patch));
  };

  const txCount = original ? state.transactions.filter((x) => x.categoryId === original.id).length : 0;
  const ruleCount = original ? state.rules.filter((r) => r.categoryId === original.id).length : 0;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {original && <p className="text-[13px] text-ink-3">{tBudget("spent", { amount: formatEuro(spentCents) })}</p>}
      <Field label={t("name")} placeholder={t("namePlaceholder")} maxLength={40} value={name} autoFocus={!original} error={nameError}
        onChange={(e) => { setName(e.target.value); setNameError(null); }} />
      <Field label={t("budget")} inputMode="decimal" placeholder="450" value={budget} error={budgetError}
        hint={t("budgetHint")} onChange={(e) => { setBudget(e.target.value); setBudgetError(null); }} />
      <FormActions label={original ? t("save") : t("submit")} removeLabel={t("remove")}
        removeHint={original && txCount + ruleCount > 0 ? t("removeHint", { transactions: txCount, rules: ruleCount }) : undefined}
        onRemove={original ? () => { onDone(); act(t("removed", { name: original.name }), removeCategory(original.id)); } : undefined} />
    </form>
  );
}

/** Edit what a rule matches and which category it files into, or delete it. */
export function RuleForm({ item, onDone }: { item: CategoryRule; onDone: () => void }) {
  const t = useTranslations("rules");
  const { state } = useHousehold();
  const { act } = useUI();
  const [original] = useState(item);
  const [contains, setContains] = useState(original.contains);
  const [category, setCategory] = useState(original.categoryId);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!contains.trim()) return setError(t("containsError"));
    const patch: Partial<{ contains: string; categoryId: string }> = {};
    // Raw compare: surrounding spaces are meaningful ("plus "), and an untouched value must never be rewritten.
    if (contains !== original.contains) patch.contains = contains;
    // A category deleted meanwhile counts as unchanged.
    if (category !== original.categoryId && state.categories.some((c) => c.id === category)) patch.categoryId = category;
    onDone();
    if (Object.keys(patch).length === 0) return;
    act(t("updated", { contains: contains.trim() }), updateRule(original.id, patch));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t("contains")} maxLength={100} value={contains} error={error}
        onChange={(e) => { setContains(e.target.value); setError(null); }} />
      <ChoiceGroup label={t("category")} value={category} onChange={setCategory}
        options={state.categories.map((c) => ({ value: c.id, label: c.name }))} />
      <FormActions label={t("save")} removeLabel={t("remove")}
        onRemove={() => { onDone(); act(t("removed", { contains: original.contains }), removeRule(original.id)); }} />
    </form>
  );
}
