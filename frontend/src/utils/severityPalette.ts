/**
 * Shared space-weather severity colour tokens.
 *
 * These CSS hex values were previously duplicated as inline literals across the
 * NOAA scale helpers and the Kp-driven colour utilities. Centralising them here
 * gives the HUD a single source of truth for severity hues, so the escalation
 * ramp stays consistent wherever it is drawn.
 */

/**
 * The six-tier NOAA scale escalation palette, shared by the geomagnetic (G),
 * radio blackout (R), and solar radiation (S) storm scales. The ramp runs from
 * quiet green through to extreme red, one hue per whole scale step.
 */
export const noaaScaleColors = {
  /** Quiet / sub-storm conditions (G0/R0/S0). */
  quiet: "#7dff6a",
  /** Minor storm (level 1). */
  minor: "#ffcc00",
  /** Moderate storm (level 2). */
  moderate: "#ff9900",
  /** Strong storm (level 3). */
  strong: "#ff6600",
  /** Severe storm (level 4). */
  severe: "#ff3300",
  /** Extreme storm (level 5). */
  extreme: "#ff0000"
} as const;

/**
 * The four-tier Kp alert palette used by the at-a-glance severity readouts
 * (the Kp colour swatch, fleet-conjunction badge, and Kp history sparkline).
 * Coarser than {@link noaaScaleColors} so it reads instantly rather than
 * tracking the full six-step scale.
 */
export const alertColors = {
  /** Quiet geomagnetic conditions. */
  calm: "#7dff6a",
  /** Watch-level activity. */
  caution: "#ffcc00",
  /** Elevated storm activity. */
  elevated: "#ff8b38",
  /** Severe storm activity. */
  severe: "#ff2a2a"
} as const;
