import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getTranslations } from "next-intl/server";
import { mailEnv } from "./env";

let transport: Transporter | undefined;

/** Sends the login code. Without a Gmail app password (dev only) the code is logged instead. */
export async function sendLoginCode(email: string, code: string): Promise<void> {
  const creds = mailEnv();
  if (!creds) {
    console.info(`[dev] login code: ${code}`);
    return;
  }
  const t = await getTranslations({ locale: "nl", namespace: "email" });
  transport ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: creds.GMAIL_USER, pass: creds.GMAIL_APP_PASSWORD },
  });
  await transport.sendMail({
    from: `"Mi casa" <${creds.GMAIL_USER}>`,
    to: email,
    subject: t("subject", { code }),
    text: t("text", { code }),
  });
}
