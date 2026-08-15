/**
 * Display-geometry helpers for the planetary Kp index.
 *
 * The Kp index is reported on a fixed 0–9 scale, so mapping a reading onto a
 * progress bar or forecast column is pure geometry that several panels share.
 * Centralising it here keeps the bar/percentage maths identical across the HUD
 * and the space-weather panels and gives the mapping a single tested home.
 */

import { clamp01 } from "./clamp";

/** The largest value the planetary Kp index can take (Kp 9, an extreme storm). */
export const KP_MAX = 9;

/**
 * Maps a Kp reading onto its fraction of the 0–9 scale, clamped to `[0, 1]`.
 * Readings at or below Kp 0 collapse to `0` and readings at or above Kp 9 to
 * `1`, so callers never have to guard against out-of-range or negative inputs.
 */
export const kpFraction = (kp: number): number => {
  if (!Number.isFinite(kp)) return 0;
  return clamp01(kp / KP_MAX);
};

/**
 * Maps a Kp reading onto a `0–100` percentage of the 0–9 scale, suitable for a
 * horizontal indicator's `left`/`width` style. Clamped via {@link kpFraction}.
 */
export const kpToPercent = (kp: number): number => kpFraction(kp) * 100;

/**
 * Maps a Kp reading onto a pixel height spanning `[0, trackHeight]`, suitable
 * for a vertical forecast bar. Negative track heights are treated as zero so
 * the result is never negative. Clamped via {@link kpFraction}.
 */
export const kpToBarHeight = (kp: number, trackHeight: number): number =>
  kpFraction(kp) * Math.max(0, trackHeight);
