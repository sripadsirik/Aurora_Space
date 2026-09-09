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
