import { describe, expect, it } from "vitest";
import { config } from "../proxy";

// Next compiles the matcher source as a path regex; the single entry is "/(<regex>)".
const re = new RegExp("^" + config.matcher[0] + "$");
const isProtected = (p: string) => re.test(p);

describe("proxy matcher", () => {
  it("leaves the bank callback and result page public", () => {
    expect(isProtected("/api/bank/callback")).toBe(false);
    expect(isProtected("/bank-klaar")).toBe(false);
  });
  it("keeps the other public paths public", () => {
    for (const p of ["/login", "/api/auth/sign-in", "/api/cron/bank", "/_next/static/a.js", "/manifest.webmanifest"])
      expect(isProtected(p)).toBe(false);
  });
  it("still protects app pages and other bank routes", () => {
    for (const p of ["/", "/geld", "/api/bank/import", "/api/bank/connect", "/taken"]) expect(isProtected(p)).toBe(true);
  });
});
