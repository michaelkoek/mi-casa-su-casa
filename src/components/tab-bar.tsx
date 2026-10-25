"use client";

import { Baby, House, Plus, SquaresFour, Wallet } from "@phosphor-icons/react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHousehold } from "@/lib/store";
import { useUI } from "./ui-provider";

const TABS = [
  { href: "/", key: "today", Icon: SquaresFour },
  { href: "/huis", key: "home", Icon: House },
  { href: "/geld", key: "money", Icon: Wallet },
  { href: "/kind", key: "child", Icon: Baby },
] as const;

export const TAB_ORDER = ["/", "/huis", "/geld", "/kind", "/meer"];

export function tabIndex(path: string) {
  if (path === "/") return 0;
  const i = TAB_ORDER.findIndex((p) => p !== "/" && path.startsWith(p));
  return i === -1 ? 0 : i;
}

export function TabBar() {
  const t = useTranslations("nav");
  const path = usePathname();
  const { state } = useHousehold();
  const { sheet, openSheet, closeSheet } = useUI();
  const current = tabIndex(path);
  const openSignals = state.signals.filter((s) => s.openedAt).length;

  const tab = (i: number) => {
    const { href, key, Icon } = TABS[i];
    const active = tabIndex(path) === TAB_ORDER.indexOf(href) && (href !== "/" || path === "/");
    const target = TAB_ORDER.indexOf(href);
    return (
      <Link
        key={href}
        href={href}
        aria-label={t(key)}
        aria-current={active ? "page" : undefined}
        transitionTypes={[target >= current ? "nav-forward" : "nav-back"]}
        className={clsx("relative grid h-12 place-items-center transition-colors duration-200", active ? "text-ink" : "text-ink-3")}
      >
        <Icon size={26} weight={active ? "fill" : "regular"} />
        {key === "home" && openSignals > 0 && (
          <span className="absolute right-[calc(50%-20px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-bg bg-accent px-1 text-[10px] font-bold text-white">
            {openSignals}
          </span>
        )}
        <span
          className={clsx(
            "absolute bottom-0.5 h-[5px] w-[5px] rounded-full bg-accent transition-transform duration-300 ease-out",
            active ? "scale-100" : "scale-0",
          )}
        />
      </Link>
    );
  };

  const sheetOpen = sheet !== null;
  return (
    <nav
      aria-label={t("label")}
      style={{ viewTransitionName: "tab-bar" }}
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-bg/95 px-[18px] pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 backdrop-blur"
    >
      <div className="grid grid-cols-5 items-center">
        {tab(0)}
        {tab(1)}
        <button
          type="button"
          aria-label={t("add")}
          aria-expanded={sheetOpen}
          onClick={() => (sheetOpen ? closeSheet() : openSheet("quick"))}
          className="press -mt-7 grid h-14 w-14 place-items-center justify-self-center rounded-full bg-accent-strong text-white shadow-[0_12px_24px_-10px_rgb(196_82_30/0.75)]"
        >
          <Plus size={24} weight="bold" className={clsx("transition-transform duration-300 ease-out", sheetOpen && "rotate-45")} />
        </button>
        {tab(2)}
        {tab(3)}
      </div>
    </nav>
  );
}
