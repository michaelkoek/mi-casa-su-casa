import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("manifest");
  return {
    name: t("name"),
    short_name: t("shortName"),
    description: t("description"),
    lang: "nl",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: t("shortcutTrash"), url: "/huis", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t("shortcutExpense"), url: "/geld?add=expense", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t("shortcutTask"), url: "/?add=task", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
