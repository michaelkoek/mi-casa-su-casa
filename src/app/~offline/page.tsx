import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { RetryButton } from "./retry-button";

export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <main className="screen-pad mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <Image src="/brand/logo-mark.svg" alt="" width={72} height={72} priority />
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">{t("title")}</h1>
      <p className="text-ink-2">{t("body")}</p>
      <RetryButton label={t("retry")} />
    </main>
  );
}
