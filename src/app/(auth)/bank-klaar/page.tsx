import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/screen";
import { doneVariant } from "@/lib/bank-callback";

/** Result of the bank link when the redirect landed outside the app (Safari has no session). Public, no data. */
async function BankDoneMessage({ searchParams }: { searchParams: PageProps<"/bank-klaar">["searchParams"] }) {
  const { result } = await searchParams;
  const v = doneVariant(Array.isArray(result) ? (result[0] ?? null) : (result ?? null));
  const t = await getTranslations("bankDone");
  const app = await getTranslations("app");
  return (
    <>
      <PageHeader eyebrow={app("name")} title={t(`${v}Title`)} />
      <p className="mt-2 text-ink-2">{t(`${v}Body`)}</p>
    </>
  );
}

export default async function BankDonePage(props: PageProps<"/bank-klaar">) {
  const app = await getTranslations("app");
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-[18px] pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+32px)]">
      <Image src="/brand/logo.svg" alt={app("name")} width={160} height={48} priority className="h-12 w-auto self-start" />
      <div className="mt-8">
        <Suspense fallback={<div aria-hidden="true" className="skeleton h-24" />}>
          <BankDoneMessage searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
