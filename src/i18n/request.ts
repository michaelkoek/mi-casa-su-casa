import { getRequestConfig } from "next-intl/server";

// One locale for now; all UI text lives in messages/nl.json.
export default getRequestConfig(async () => ({
  locale: "nl",
  timeZone: "Europe/Amsterdam",
  messages: (await import("../../messages/nl.json")).default,
}));
