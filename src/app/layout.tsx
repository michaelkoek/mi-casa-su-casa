import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { SerwistProvider } from "@serwist/turbopack/react";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: t("name"),
    description: t("tagline"),
    applicationName: t("name"),
    appleWebApp: { capable: true, title: t("shortName"), statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111216" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-[100dvh]">
        <NextIntlClientProvider>
          <SerwistProvider
            swUrl="/serwist/sw.js"
            disable={process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_SW_IN_DEV !== "true"}
          >
            {children}
          </SerwistProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
