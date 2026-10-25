"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { hardNavigate } from "@/lib/navigate";
import { Field, PrimaryButton, SoftButton } from "./form";

type ErrorKey = "emailError" | "wrongCode" | "expired" | "tooMany" | "network" | "codeError" | "serverError";

type FormState = {
  step: "email" | "code";
  email: string;
  code: string;
  error: ErrorKey | null;
  busy: boolean;
  resendAt: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_MS = 30000;

type AuthError = { status?: number; code?: string; message?: string } | null | undefined;

function mapError(error: AuthError, step: FormState["step"]): ErrorKey {
  const code = `${error?.code ?? ""} ${error?.message ?? ""}`.toUpperCase();
  if (error?.status === 429) return "tooMany";
  if (code.includes("TOO_MANY")) return "tooMany";
  if (code.includes("EXPIRED")) return "expired";
  if (code.includes("INVALID_OTP") || code.includes("INVALID OTP")) return "wrongCode";
  if (!error?.status) return "network";
  if (error.status >= 500 || step === "email") return "serverError";
  return "wrongCode";
}

/** Two steps: email, then the 6-digit code that was mailed. */
export function LoginForm() {
  const t = useTranslations("auth");
  const [s, setS] = useState<FormState>({ step: "email", email: "", code: "", error: null, busy: false, resendAt: 0 });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (s.resendAt <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [s.resendAt]);

  const secondsLeft = Math.max(0, Math.ceil((s.resendAt - now) / 1000));

  const sendCode = async (email: string) => {
    setS((p) => ({ ...p, busy: true, error: null }));
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
      if (res.error) {
        setS((p) => ({ ...p, busy: false, error: mapError(res.error, "email") }));
        return;
      }
      setNow(Date.now());
      setS((p) => ({ ...p, step: "code", code: "", busy: false, resendAt: Date.now() + RESEND_MS }));
    } catch {
      setS((p) => ({ ...p, busy: false, error: "network" }));
    }
  };

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    const email = s.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return setS((p) => ({ ...p, error: "emailError" }));
    void sendCode(email);
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (s.code.length !== 6 || s.busy) return;
    setS((p) => ({ ...p, busy: true, error: null }));
    try {
      const res = await authClient.signIn.emailOtp({ email: s.email.trim().toLowerCase(), otp: s.code });
      if (res.error) {
        setS((p) => ({ ...p, busy: false, error: mapError(res.error, "code") }));
        return;
      }
      hardNavigate("/");
    } catch {
      setS((p) => ({ ...p, busy: false, error: "network" }));
    }
  };

  return (
    <MotionConfig reducedMotion="user">
    <AnimatePresence mode="wait" initial={false}>
      {s.step === "email" ? (
        <motion.form
          key="email"
          onSubmit={submitEmail}
          noValidate
          className="flex flex-col gap-4"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.24 }}
        >
          <Field
            label={t("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder={t("emailPlaceholder")}
            value={s.email}
            error={s.error ? t(s.error) : null}
            onChange={(e) => setS((p) => ({ ...p, email: e.target.value, error: null }))}
          />
          <PrimaryButton type="submit" disabled={s.busy}>{t("sendCode")}</PrimaryButton>
        </motion.form>
      ) : (
        <motion.form
          key="code"
          onSubmit={submitCode}
          className="flex flex-col gap-4"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.24 }}
        >
          <p className="text-sm text-ink-2">{t("codeSent", { email: s.email.trim().toLowerCase() })}</p>
          <Field
            label={t("code")}
            hint={t("codeHint")}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={s.code}
            error={s.error ? t(s.error) : null}
            onChange={(e) => setS((p) => ({ ...p, code: e.target.value.replace(/\D/g, "").slice(0, 6), error: null }))}
          />
          <PrimaryButton type="submit" disabled={s.busy || s.code.length !== 6}>{t("submit")}</PrimaryButton>
          <SoftButton disabled={s.busy || secondsLeft > 0} onClick={() => void sendCode(s.email.trim().toLowerCase())}>
            {secondsLeft > 0 ? t("resendIn", { seconds: secondsLeft }) : t("resend")}
          </SoftButton>
          <button
            type="button"
            className="press h-11 text-sm font-medium text-ink-2"
            onClick={() => setS((p) => ({ ...p, step: "email", code: "", error: null }))}
          >
            {t("otherEmail")}
          </button>
        </motion.form>
      )}
    </AnimatePresence>
    </MotionConfig>
  );
}
