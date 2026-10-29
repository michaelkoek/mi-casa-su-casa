/* Pure maths for pull-to-refresh: rubber band, progress, phases and the gesture's direction lock. */

/** px of resisted distance that arms a refresh; also the chip's rest offset while refreshing. */
export const PULL_THRESHOLD = 64;
/** Asymptote of resist(). */
export const PULL_MAX = 110;
/** px before the direction is decided. */
export const LOCK_DISTANCE = 10;
export const MIN_VISIBLE_MS = 600;

export type PullPhase = "idle" | "pulling" | "armed" | "refreshing";

/** Rubber band: PULL_MAX * (1 - exp(-raw / PULL_MAX)); 0 for raw <= 0 or non-finite. */
export function resist(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return PULL_MAX * (1 - Math.exp(-raw / PULL_MAX));
}

export function progress(dist: number): number {
  return Math.min(1, Math.max(0, dist / PULL_THRESHOLD));
}

export function pullPhase(dist: number, released: boolean): PullPhase {
  if (dist <= 0) return "idle";
  if (!released) return dist >= PULL_THRESHOLD ? "armed" : "pulling";
  return dist >= PULL_THRESHOLD ? "refreshing" : "idle";
}

/** Decides what a touch is: not at the top or sideways/upward → cancel; too short → wait; else pull. */
export function shouldStart(scrollY: number, dx: number, dy: number): "wait" | "pull" | "cancel" {
  if (scrollY > 0) return "cancel";
  if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_DISTANCE) return "wait";
  if (Math.abs(dx) >= Math.abs(dy) || dy <= 0) return "cancel";
  return "pull";
}
