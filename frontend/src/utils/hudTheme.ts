import type { VisualMode } from "../types/space";
import type { FreshnessStatus } from "./feedFreshness";
import { isStormModeActive } from "./visualMode";

/** Mode-dependent colour palette used to shade the HUD overlay. */
export interface HudTheme {
  /** True while INTEL mode is selected. */
  isIntel: boolean;
  /** True while the storm treatment is active (see {@link isStormModeActive}). */
  isStorm: boolean;
  /** Primary foreground colour for HUD body text. */
  textColor: string;
  /** Accent colour for section headings and highlights. */
  accentColor: string;
  /** Muted colour for secondary readouts under the space-weather panel. */
  subTextColor: string;
  /** Foreground colour for the active-alerts list. */
  alertTextColor: string;
  /** Muted colour for the data-layer source labels. */
  sourceColor: string;
  /** Colour for the UTC clock readout. */
  clockColor: string;
}

/**
 * Derives the HUD's colour palette from the current visual mode and effective Kp
 * index. INTEL mode takes precedence with its stark orange-on-black scheme; an
 * active storm warms the palette; otherwise the calm default theme is used.
 */
export const getHudTheme = (mode: VisualMode, kpIndex: number): HudTheme => {
  const isIntel = mode === "INTEL";
  const isStorm = isStormModeActive(mode, kpIndex);

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

/**
 * Tailwind background-colour class for a data-layer freshness dot: green (or
 * INTEL orange) when `live`, amber when `stale`, and red when `error`.
 */
export const hudFreshnessDotClass = (status: FreshnessStatus, isIntel: boolean): string => {
  if (status === "live") {
    return isIntel ? "bg-[#ff6600]" : "bg-[#00ff88]";
  }
  if (status === "stale") {
    return "bg-[#ffcc00]";
  }
  return "bg-[#ff4444]";
};
