"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { PrimaryButton } from "@/components/form";

/** Catches failures below the root layout, such as the database being unreachable in the (app) layout. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="screen-pad mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <Image src="/brand/logo-mark.svg" alt="" width={72} height={72} priority />
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">{t("title")}</h1>
      <p className="text-ink-2">{t("body")}</p>
      <PrimaryButton type="button" onClick={() => retry()}>
        {t("retry")}
      </PrimaryButton>
    </main>
  );
}
