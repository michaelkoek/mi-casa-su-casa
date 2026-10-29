import { describe, expect, it } from "vitest";
import { callbackOutcome, doneVariant, parseOutcome, toastKey, type ImportResult } from "./bank-callback";

describe("bank-callback edges", () => {
  it("every status maps to a defined outcome, and never to cancelled", () => {
    for (const status of ["ok", "expired", "rate_limited", "error"] as const)
      for (const imported of [0, 1, 99]) {
        const o = callbackOutcome({ status, imported } as ImportResult);
        expect(parseOutcome(o)).toBe(o);
        expect(o).not.toBe("cancelled");
      }
  });
  it("expired fails even with imported rows", () => expect(callbackOutcome({ status: "expired", imported: 7 })).toBe("failed"));
  it("parseOutcome rejects garbage, case variants, empty and prototype keys", () => {
    for (const v of ["", " linked", "LINKED", "linked ", "__proto__", "constructor", "toString", "linked,failed", "0", "null"])
      expect(parseOutcome(v)).toBeNull();
  });
  it("empty param is an unknown value: linkFailed toast, failed page", () => {
    expect(toastKey("")).toBe("linkFailed");
    expect(doneVariant("")).toBe("failed");
  });
  it("garbage never yields a success variant", () => {
    for (const v of ["__proto__", "LINKED", "<script>"]) {
      expect(toastKey(v)).toBe("linkFailed");
      expect(doneVariant(v)).toBe("failed");
    }
  });
});
