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

/**
 * Scattered moonlight scales with the lit area of the Moon's disc rather than
 * its diameter, so a half-lit Moon adds far less sky-glow than half of a full
 * Moon's. Squaring the illuminated fraction gives a simple perceptual weight
 * that keeps crescents dark and bunches the intrusive glow toward the full-Moon
 * end, matching how the tiers in {@link classifyMoonlightInterference} feel.
 */
export const moonlightSeverity = (illumination: number): number => {
  const fraction = moonIlluminationFraction(illumination);
  return fraction * fraction;
};

/**
 * Whether the prevailing moonlight is strong enough to hide a faint aurora — a
 * horizon glow or the first stirrings of a display. True for a `bright` or
 * `washed-out` Moon and false for `dark` or `dim` skies. Exposed as a predicate
 * so callers can gate their own faint-aurora warnings without re-deriving the
 * tier, and reused by {@link adjustAuroraChanceForMoonlight}.
 */
export const drownsOutFaintAurora = (illumination: number): boolean => {
  const interference = classifyMoonlightInterference(illumination);
  return interference === "bright" || interference === "washed-out";
};

/**
 * Adjusts an aurora {@link AuroraChance} downward for the prevailing moonlight.
 * Aurora that reaches `overhead` is a bright, structured display that survives
 * even a full Moon, so it is never demoted. A faint `horizon` glow, by contrast,
 * is the first thing to vanish under sky-glow: a `bright` or `washed-out` Moon
 * drops it to `none`, while `dark` and `dim` skies leave it intact. A `none`
 * chance has nothing to lose and is returned unchanged. This keeps the physical
 * asymmetry — the Moon hides subtle aurora but not vivid ones — in one place.
 */
export const adjustAuroraChanceForMoonlight = (
  chance: AuroraChance,
  illumination: number
): AuroraChance => {
  if (chance !== "horizon") return chance;
  const interference = classifyMoonlightInterference(illumination);
  const drownsOutHorizonGlow = interference === "bright" || interference === "washed-out";
  return drownsOutHorizonGlow ? "none" : "horizon";
};

/** Moonlight outlook for one illuminated fraction, ready to drive a panel. */
export interface MoonlightSummary {
  /** Normalised illuminated fraction, `0`–`1`. */
  fraction: number;
  /** The moonlight interference tier for this fraction. */
  interference: MoonlightInterference;
  /** Human-readable label for {@link interference}. */
  interferenceLabel: string;
  /** Perceptual sky-glow weight, `0`–`1`. */
  severity: number;
}

/**
 * Bundles the moonlight figures for one illuminated fraction into a single
 * struct, so a display can derive every value from one reading. All members
 * reuse the individual helpers in this module, keeping them mutually consistent.
 */
export const summarizeMoonlight = (illumination: number): MoonlightSummary => {
  const interference = classifyMoonlightInterference(illumination);
  return {
    fraction: moonIlluminationFraction(illumination),
    interference,
    interferenceLabel: MOONLIGHT_INTERFERENCE_LABELS[interference],
    severity: moonlightSeverity(illumination)
  };
};
