import type { VisualMode } from "../types/space";

/** Kp index above which geomagnetic activity is treated as an active storm. */
export const STORM_KP_THRESHOLD = 5;

/**
 * Whether a Kp reading represents storm-level geomagnetic activity, i.e. it has
 * climbed strictly past {@link STORM_KP_THRESHOLD}. This is the single predicate
 * every storm-mode decision keys off, so the exclusive threshold stays in one
 * place instead of being re-spelled as a bare `kp > 5` across the components.
 */
export const isStormLevelKp = (kpIndex: number): boolean => kpIndex > STORM_KP_THRESHOLD;

/**
 * Whether the storm treatment (warm palette, storm overlay, auto-trigger) should
 * be active. True when the operator has explicitly selected STORM mode, or when
 * the effective Kp index has climbed past {@link STORM_KP_THRESHOLD} regardless
 * of the current mode.
 */
export const isStormModeActive = (mode: VisualMode, kpIndex: number): boolean =>
  mode === "STORM" || isStormLevelKp(kpIndex);
