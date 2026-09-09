/**
 * Moonlight-interference helpers for aurora viewing.
 *
 * Knowing the aurora is above the horizon (see {@link ./auroraVisibility}) is
 * only part of the story: a bright Moon floods the night sky with scattered
 * light that washes out faint aurora, so the same storm that dazzles under a new
 * Moon can be invisible under a full one. The Moon's illuminated fraction — the
 * share of its disc lit by the Sun, `0` at new Moon and `1` at full — is the
 * single number that captures how much sky-glow it adds. This module turns that
 * fraction into a viewing-interference tier and folds it into the aurora chance,
 * so the HUD and space-weather panels can warn "great storm, but the Moon will
 * drown it out" from one tested source.
 */

import { clamp01 } from "./clamp";
import type { AuroraChance } from "./auroraVisibility";

/**
 * Normalises a raw Moon illuminated-fraction reading to `[0, 1]`. Values below
 * `0` collapse to a new Moon and values above `1` to a full Moon, and a
 * non-finite reading is treated as a new Moon (`0`, no interference), so callers
 * never have to guard the input.
 */
export const moonIlluminationFraction = (illumination: number): number => {
  if (!Number.isFinite(illumination)) return 0;
  return clamp01(illumination);
};

/**
 * How much the Moon degrades aurora viewing, ordered from best to worst: `dark`
 * (little to no sky-glow, faint aurora survive), `dim` (a crescent adds a slight
 * wash), `bright` (a broad gibbous Moon noticeably drowns faint structure), and
 * `washed-out` (a near-full Moon leaves only the brightest aurora visible).
 */
export type MoonlightInterference = "dark" | "dim" | "bright" | "washed-out";

/**
 * Illuminated-fraction thresholds separating the {@link MoonlightInterference}
 * tiers. A reading at or above `dim` leaves the `dark` tier, at or above
 * `bright` the `dim` tier, and at or above `washedOut` the `bright` tier. The
 * cut points follow the familiar phase names — a thin crescent through first
 * quarter stays fairly dark, a waxing gibbous grows intrusive, and the days
 * around full Moon are hopeless for faint aurora.
 */
export const MOONLIGHT_INTERFERENCE_THRESHOLDS = {
  dim: 0.1,
  bright: 0.5,
  washedOut: 0.85
} as const;

/**
 * Classifies the moonlight interference for a raw illuminated fraction using
 * {@link MOONLIGHT_INTERFERENCE_THRESHOLDS}. The reading is first normalised via
 * {@link moonIlluminationFraction}, so out-of-range or non-finite inputs fall in
 * the `dark` tier rather than throwing. A brighter Moon yields a worse tier.
 */
export const classifyMoonlightInterference = (illumination: number): MoonlightInterference => {
  const fraction = moonIlluminationFraction(illumination);
  if (fraction >= MOONLIGHT_INTERFERENCE_THRESHOLDS.washedOut) return "washed-out";
  if (fraction >= MOONLIGHT_INTERFERENCE_THRESHOLDS.bright) return "bright";
  if (fraction >= MOONLIGHT_INTERFERENCE_THRESHOLDS.dim) return "dim";
  return "dark";
};

/**
 * Short human-readable label for each {@link MoonlightInterference} tier, for
 * legends, badges, and panel copy. Centralised so every display names the tiers
 * identically.
 */
export const MOONLIGHT_INTERFERENCE_LABELS: Record<MoonlightInterference, string> = {
  dark: "Dark skies",
  dim: "Slight moonlight",
  bright: "Bright Moon",
  "washed-out": "Washed out by Moon"
};
