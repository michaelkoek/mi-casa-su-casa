import { describe, expect, it } from "vitest";
import { PULL_MAX, PULL_THRESHOLD, progress, pullPhase, resist, shouldStart } from "./pull-refresh";

describe("resist", () => {
  it("is 0 for zero, negative and non-finite input", () => {
    expect(resist(0)).toBe(0);
    expect(resist(-20)).toBe(0);
    expect(resist(NaN)).toBe(0);
    expect(resist(Infinity)).toBe(0);
  });
  it("increases but never reaches the maximum", () => {
    let prev = 0;
    for (const raw of [1, 10, 50, 100, 300, 1000]) {
      const d = resist(raw);
      expect(d).toBeGreaterThan(prev);
      expect(d).toBeLessThan(PULL_MAX);
      prev = d;
    }
  });
  it("follows the finger for small pulls", () => {
    expect(resist(5)).toBeCloseTo(5, 0);
  });
  it("arms the threshold at about 96px of travel", () => {
    expect(resist(96)).toBeGreaterThan(PULL_THRESHOLD - 1);
    expect(resist(90)).toBeLessThan(PULL_THRESHOLD);
  });
});

describe("progress", () => {
  it("clamps between 0 and 1", () => {
    expect(progress(-5)).toBe(0);
    expect(progress(32)).toBe(0.5);
    expect(progress(PULL_THRESHOLD)).toBe(1);
    expect(progress(500)).toBe(1);
  });
});

describe("pullPhase", () => {
  it("covers every branch", () => {
    expect(pullPhase(0, false)).toBe("idle");
    expect(pullPhase(-3, true)).toBe("idle");
    expect(pullPhase(20, false)).toBe("pulling");
    expect(pullPhase(PULL_THRESHOLD - 0.1, false)).toBe("pulling");
    expect(pullPhase(PULL_THRESHOLD, false)).toBe("armed");
    expect(pullPhase(20, true)).toBe("idle");
    expect(pullPhase(PULL_THRESHOLD, true)).toBe("refreshing");
  });
});

describe("shouldStart", () => {
  it("cancels when scrolled down", () => expect(shouldStart(40, 0, 30)).toBe("cancel"));
  it("waits on small moves", () => expect(shouldStart(0, 3, 6)).toBe("wait"));
  it("cancels horizontal swipes", () => expect(shouldStart(0, 30, 12)).toBe("cancel"));
  it("cancels a diagonal tie", () => expect(shouldStart(0, 15, 15)).toBe("cancel"));
  it("cancels upward swipes", () => expect(shouldStart(0, 0, -30)).toBe("cancel"));
  it("pulls on a downward move", () => expect(shouldStart(0, 2, 12)).toBe("pull"));
});
