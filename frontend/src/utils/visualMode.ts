import type { VisualMode } from "../types/space";

/** Kp index above which geomagnetic activity is treated as an active storm. */
export const STORM_KP_THRESHOLD = 5;

/**
 * Whether the storm treatment (warm palette, storm overlay, auto-trigger) should
 * be active. True when the operator has explicitly selected STORM mode, or when
 * the effective Kp index has climbed past {@link STORM_KP_THRESHOLD} regardless
 * of the current mode.
 */
export const isStormModeActive = (mode: VisualMode, kpIndex: number): boolean =>
  mode === "STORM" || kpIndex > STORM_KP_THRESHOLD;
