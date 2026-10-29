import { describe, expect, it } from "vitest";
import { LOCK_DISTANCE, PULL_MAX, PULL_THRESHOLD, progress, pullPhase, resist, shouldStart } from "./pull-refresh";

describe("pull-refresh edges", () => {
  it("resist is strictly monotonic and capped over a dense range", () => {
    let prev = -1;
    for (let raw = 1; raw <= 600; raw += 3) {
      const d = resist(raw);
      expect(d).toBeGreaterThan(prev);
      expect(d).toBeLessThanOrEqual(PULL_MAX);
      prev = d;
    }
    expect(resist(-Infinity)).toBe(0);
  });
  it("progress at NaN-free boundaries", () => {
    expect(progress(0)).toBe(0);
    expect(progress(PULL_THRESHOLD - 1)).toBeLessThan(1);
  });
  it("released at exactly zero is idle", () => expect(pullPhase(0, true)).toBe("idle"));
  it("shouldStart: scrolled by 1px cancels even for a clean pull", () => expect(shouldStart(1, 0, 50)).toBe("cancel"));
  it("shouldStart: lock boundary", () => {
    expect(shouldStart(0, 0, LOCK_DISTANCE - 1)).toBe("wait");
    expect(shouldStart(0, 0, LOCK_DISTANCE)).toBe("pull");
    expect(shouldStart(0, -(LOCK_DISTANCE - 1), 0)).toBe("wait");
  });
  it("shouldStart: leftward horizontal and zero-dy cancel", () => {
    expect(shouldStart(0, -40, 5)).toBe("cancel");
    expect(shouldStart(0, 0, 0)).toBe("wait");
  });
  it("shouldStart: large upward move cancels even when dx is small", () => expect(shouldStart(0, 1, -100)).toBe("cancel"));
});
