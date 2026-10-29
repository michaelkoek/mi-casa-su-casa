import { describe, expect, it } from "vitest";
import { callbackOutcome, doneVariant, parseOutcome, toastKey } from "./bank-callback";

describe("callbackOutcome", () => {
  it("maps import results", () => {
    expect(callbackOutcome({ status: "ok", imported: 5 })).toBe("linked");
    expect(callbackOutcome({ status: "ok", imported: 0 })).toBe("linked-empty");
    expect(callbackOutcome({ status: "error", imported: 0 })).toBe("linked-later");
    expect(callbackOutcome({ status: "rate_limited", imported: 0 })).toBe("linked-later");
    expect(callbackOutcome({ status: "error", imported: 3 })).toBe("linked-later");
    expect(callbackOutcome({ status: "expired", imported: 0 })).toBe("failed");
  });
});

describe("parseOutcome", () => {
  it("accepts known values only", () => {
    for (const v of ["linked", "linked-empty", "linked-later", "cancelled", "failed"]) expect(parseOutcome(v)).toBe(v);
    expect(parseOutcome(null)).toBeNull();
    expect(parseOutcome("x")).toBeNull();
  });
});

describe("toastKey", () => {
  it("maps outcomes to bank keys", () => {
    expect(toastKey("linked")).toBe("linked");
    expect(toastKey("linked-empty")).toBe("linkedEmpty");
    expect(toastKey("linked-later")).toBe("linkedLater");
    expect(toastKey("cancelled")).toBe("cancelled");
    expect(toastKey("failed")).toBe("linkFailed");
  });
  it("handles missing and unknown values", () => {
    expect(toastKey(null)).toBeNull();
    expect(toastKey("whatever")).toBe("linkFailed");
  });
});

describe("doneVariant", () => {
  it("groups outcomes", () => {
    expect(doneVariant("linked")).toBe("linked");
    expect(doneVariant("linked-empty")).toBe("linked");
    expect(doneVariant("linked-later")).toBe("linked");
    expect(doneVariant("cancelled")).toBe("cancelled");
    expect(doneVariant("failed")).toBe("failed");
    expect(doneVariant(null)).toBe("failed");
    expect(doneVariant("garbage")).toBe("failed");
  });
});
