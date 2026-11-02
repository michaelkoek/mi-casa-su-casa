import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

export function Tile({
  href, tone, h, i, title, sub, detail, subTone, badge, children,
}: { href: string; tone: string; h: string; i: number; title: string; sub: string; detail?: string; subTone?: string; badge?: string; children: ReactNode }) {
  return (
    <Link href={href} transitionTypes={["nav-forward"]} style={{ ["--i" as string]: i }}
      className={clsx("press rise relative flex flex-col gap-1 overflow-hidden rounded-[24px] p-4", tone, h)}>
      <span className="relative z-10 max-w-[11ch] text-[15px] font-semibold leading-tight">{title}</span>
      <span className={clsx("relative z-10 text-xs font-medium", subTone ?? "text-ink-2")}>{sub}</span>
      {detail && (
        <span className="relative z-10 mt-1 line-clamp-3 max-w-[15ch] text-[13px] font-medium leading-snug text-ink">{detail}</span>
      )}
      {badge && (
        <span className="absolute right-3.5 top-3.5 z-10 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">{badge}</span>
      )}
      <span className="pointer-events-none absolute -bottom-2 -right-2">{children}</span>
    </Link>
  );
}
