"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useHousehold } from "@/lib/store";
import type { CategoryRule } from "@/lib/types";
import { RuleForm } from "../money-forms";
import { PageHeader, Screen } from "../screen";
import { Sheet } from "../sheet";

export function RulesScreen() {
  return (
    <Screen>
      <Rules />
    </Screen>
  );
}

function Rules() {
  const t = useTranslations("rules");
  const { state } = useHousehold();
  const [openId, setOpenId] = useState<string | null>(null);
  // Separate from openId so the sheet keeps its content while it slides away.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const categoryName = new Map(state.categories.map((c) => [c.id, c.name]));
  const rule = state.rules.find((r) => r.id === openId) ?? null;
  // Deleted (by us or the other member): close for good, so an undo doesn't reopen the sheet.
  if (sheetOpen && rule === null) setSheetOpen(false);

  const open = (id: string) => {
    setOpenId(id);
    setFormKey((k) => k + 1);
    setSheetOpen(true);
  };

  return (
    <>
      <Link href="/geld" transitionTypes={["nav-back"]} className="press -ml-2 mb-2 inline-flex h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-ink-2">
        <CaretLeft size={18} /> {t("back")}
      </Link>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <p className="mt-2 text-sm text-ink-2">{t("intro")}</p>

      {state.rules.length === 0 ? (
        <p className="mt-6 rounded-[22px] bg-surface p-4 text-sm text-ink-2">{t("empty")}</p>
      ) : (
        <ul className="mt-6 rounded-[22px] bg-surface px-4">
          {state.rules.map((r) => (
            <li key={r.id} className="border-b border-line last:border-b-0">
              <button type="button" onClick={() => open(r.id)} className="flex min-h-14 w-full items-center gap-3 py-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.contains}</span>
                  <span className="block truncate text-[13px] text-ink-3">{categoryName.get(r.categoryId) ?? t("unknownCategory")}</span>
                </span>
                <CaretRight size={18} className="flex-none text-ink-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <RuleSheet rule={rule} open={sheetOpen} formKey={formKey} onClose={() => setSheetOpen(false)} />
    </>
  );
}

function RuleSheet({ rule, open, formKey, onClose }: { rule: CategoryRule | null; open: boolean; formKey: number; onClose: () => void }) {
  const t = useTranslations("rules");
  return (
    <Sheet open={open && rule !== null} onClose={onClose} title={t("editTitle")}>
      {rule && <RuleForm key={formKey} item={rule} onDone={onClose} />}
    </Sheet>
  );
}
