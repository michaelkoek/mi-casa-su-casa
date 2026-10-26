import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { PageHeader } from "@/components/screen";
import { SignOutButton } from "@/components/sign-out-button";
import { DEV_LOGIN_CODE, devLogin } from "@/lib/server/dev-login";
import { getAuthState, listMembersForDevLogin } from "@/lib/server/household";

async function LoginGate() {
  const state = await getAuthState();
  if (state.status === "member") redirect("/");
  if (state.status === "no-member") {
    const t = await getTranslations("auth");
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t("noAccessTitle")}</h2>
        <p className="text-ink-2">{t("noAccess", { email: state.email })}</p>
        <SignOutButton label={t("signOut")} />
      </div>
    );
  }
  const dev = devLogin ? { code: DEV_LOGIN_CODE, members: await listMembersForDevLogin() } : undefined;
  return <LoginForm dev={dev} />;
}

export default async function LoginPage() {
  const t = await getTranslations("auth");
  const app = await getTranslations("app");
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-[18px] pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+32px)]">
      <Image src="/brand/logo.svg" alt={app("name")} width={160} height={48} priority className="h-12 w-auto self-start" />
      <div className="mt-8">
        <PageHeader eyebrow={app("name")} title={t("title")} />
        <p className="mt-2 text-ink-2">{t("intro")}</p>
      </div>
      <div className="mt-auto pt-10">
        <Suspense fallback={<div aria-hidden="true" className="skeleton h-40" />}>
          <LoginGate />
        </Suspense>
      </div>
    </main>
  );
}
