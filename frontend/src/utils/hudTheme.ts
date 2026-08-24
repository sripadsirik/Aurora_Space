import type { VisualMode } from "../types/space";
import { STORM_KP_THRESHOLD, isStormModeActive } from "./visualMode";

/** Resolved colour tokens for the HUD's mode-dependent styling. */
export interface HudTheme {
  /** True when the active mode is INTEL (orange monochrome accent). */
  isIntel: boolean;
  /**
   * True when storm styling applies — either the STORM mode is active or the
   * displayed Kp index has climbed above the storm threshold (Kp 5).
   */
  isStorm: boolean;
  /** Primary text colour for HUD panels. */
  textColor: string;
  /** Accent colour used for panel headings and highlights. */
  accentColor: string;
  /** Muted colour used for secondary readouts inside a panel. */
  subTextColor: string;
  /** Foreground colour for the active-alerts list. */
  alertTextColor: string;
  /** Muted colour for the data-layer source labels. */
  sourceColor: string;
  /** Colour for the UTC clock readout. */
  clockColor: string;
}

/**
 * Displayed Kp above this threshold pulls the HUD into storm styling. Re-exported
 * from {@link STORM_KP_THRESHOLD} so the HUD and the storm overlay share one
 * definition of "storm".
 */
export const HUD_STORM_KP_THRESHOLD = STORM_KP_THRESHOLD;

/**
 * Derives the HUD's mode-dependent colour tokens from the active view mode and
 * the currently displayed Kp index. INTEL mode wins over storm styling and uses
 * a monochrome orange accent; storm styling (STORM mode, or any mode once Kp
 * climbs above {@link HUD_STORM_KP_THRESHOLD}) warms the palette; otherwise the
 * calm default Aurora tokens apply. Extracted from the HUD component so the
 * branch logic has a single tested definition.
 */
export const deriveHudTheme = (mode: VisualMode, kp: number): HudTheme => {
  const isIntel = mode === "INTEL";
  const isStorm = isStormModeActive(mode, kp);
  return {
    isIntel,
    isStorm,
    textColor: isIntel ? "#ffffff" : isStorm ? "#ffd8b8" : "var(--aurora-text)",
    accentColor: isIntel ? "#ff6600" : isStorm ? "#ff8844" : "var(--aurora-accent)",
    subTextColor: isIntel ? "#cccccc" : isStorm ? "#ffccaa" : "#cde4f6",
    alertTextColor: isIntel ? "#cccccc" : "#d8ebff",
    sourceColor: isIntel ? "#999999" : "#9ec3df",
    clockColor: isIntel ? "#009933" : "#b9d6ee"
  };
};
