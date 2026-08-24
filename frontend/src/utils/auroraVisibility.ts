/**
 * Aurora visibility helpers keyed to the planetary Kp index.
 *
 * As geomagnetic activity rises the auroral oval expands toward the equator, so
 * a higher Kp means the aurora can be seen from lower latitudes. NOAA SWPC
 * publishes an approximate mapping from Kp to the corrected-geomagnetic latitude
 * of the oval's equatorward (overhead) edge; this module centralises that
 * mapping so the HUD and space-weather panels can answer "where might the aurora
 * be visible tonight?" from a single tested source.
 *
 * The figures model the latitude at which the aurora is roughly overhead. The
 * glow can still be seen lower on the poleward horizon from some way equatorward
 * of that edge, which {@link AURORA_HORIZON_ALLOWANCE_DEG} accounts for.
 */

import { clamp } from "./clamp";

/**
 * Approximate corrected-geomagnetic latitude, in degrees, of the auroral oval's
 * equatorward (overhead) edge for each integer Kp level 0–9, following NOAA
 * SWPC's published Kp-to-viewing-latitude guidance. Index `i` holds the boundary
 * for Kp `i`; the oval reaches steadily lower latitudes as Kp climbs.
 */
export const AURORA_BOUNDARY_LATITUDES_BY_KP: readonly number[] = [
  66.5, // Kp 0
  64.5, // Kp 1
  62.4, // Kp 2
  60.4, // Kp 3
  58.3, // Kp 4
  56.3, // Kp 5
  54.2, // Kp 6
  52.2, // Kp 7
  50.1, // Kp 8
  48.1 // Kp 9
] as const;

/** The largest value the planetary Kp index can take (Kp 9, an extreme storm). */
export const KP_MAX = 9;

/**
 * Approximate corrected-geomagnetic latitude of the aurora's overhead edge for a
 * Kp reading, linearly interpolating {@link AURORA_BOUNDARY_LATITUDES_BY_KP}
 * between integer levels. Kp is clamped to `[0, 9]`, so out-of-range or
 * non-finite readings collapse to the nearest endpoint and callers never have to
 * guard the input. A higher Kp yields a lower boundary latitude.
 */
export const auroraBoundaryLatitude = (kp: number): number => {
  const safeKp = Number.isFinite(kp) ? clamp(kp, 0, KP_MAX) : 0;
  const lower = Math.floor(safeKp);
  const upper = Math.ceil(safeKp);
  const lowerLat = AURORA_BOUNDARY_LATITUDES_BY_KP[lower];
  if (lower === upper) return lowerLat;
  const upperLat = AURORA_BOUNDARY_LATITUDES_BY_KP[upper];
  return lowerLat + (upperLat - lowerLat) * (safeKp - lower);
};

/**
 * Degrees of latitude, equatorward of the overhead boundary, from which a bright
 * aurora can still be glimpsed low on the poleward horizon. Aurora seen near the
 * horizon originates hundreds of kilometres poleward of the observer, so the
 * viewable zone extends this far below the overhead edge. A modelling
 * approximation rather than a hard cutoff.
 */
export const AURORA_HORIZON_ALLOWANCE_DEG = 8;

/**
 * Signed latitude margin, in degrees, between an observer and the aurora's
 * overhead boundary for a given Kp. Positive when the observer is poleward of
 * the boundary (aurora overhead or beyond); negative when equatorward of it. The
 * observer latitude is compared by magnitude, so the helper works for either
 * hemisphere. Returns `NaN` when the observer latitude is not finite.
 */
export const auroraVisibilityMargin = (kp: number, observerLatitude: number): number => {
  if (!Number.isFinite(observerLatitude)) return Number.NaN;
  return Math.abs(observerLatitude) - auroraBoundaryLatitude(kp);
};

/**
 * How likely the aurora is to be seen from an observer's latitude, ordered from
 * best to worst: `overhead` (the oval reaches the observer), `horizon` (only a
 * glow low on the poleward horizon), and `none` (too far equatorward to see it).
 */
export type AuroraChance = "overhead" | "horizon" | "none";

/**
 * Classifies an observer's aurora prospects for a given Kp from their
 * {@link auroraVisibilityMargin}. A margin at or above zero means the oval is
 * overhead; a margin within {@link AURORA_HORIZON_ALLOWANCE_DEG} below the edge
 * means a horizon glow is possible; anything further equatorward is `none`. A
 * non-finite observer latitude is treated as `none`.
 */
export const classifyAuroraChance = (kp: number, observerLatitude: number): AuroraChance => {
  const margin = auroraVisibilityMargin(kp, observerLatitude);
  if (!Number.isFinite(margin)) return "none";
  if (margin >= 0) return "overhead";
  if (margin >= -AURORA_HORIZON_ALLOWANCE_DEG) return "horizon";
  return "none";
};

/**
 * Short human-readable label for each {@link AuroraChance}, for legends, badges,
 * and panel copy. Centralised so every display names the tiers identically.
 */
export const AURORA_CHANCE_LABELS: Record<AuroraChance, string> = {
  overhead: "Overhead",
  horizon: "On the horizon",
  none: "Not visible"
};
