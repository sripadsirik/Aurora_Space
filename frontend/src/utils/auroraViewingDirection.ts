/**
 * Aurora viewing-direction helpers.
 *
 * Knowing *whether* the aurora is visible from a latitude (see
 * {@link ./auroraVisibility}) only answers half the observer's question; the
 * other half is *where to look*. The auroral oval sits over the geomagnetic
 * pole, so an observer equatorward of it always looks poleward — north in the
 * Northern Hemisphere, south in the Southern. This module turns an observer's
 * latitude and visibility tier into a concrete compass bearing and an elevation
 * hint, so the HUD and space-weather panels can point people at the sky from a
 * single tested source.
 */

import type { AuroraChance } from "./auroraVisibility";

/** Which hemisphere an observer stands in, north or south of the equator. */
export type Hemisphere = "northern" | "southern";

/**
 * The hemisphere an observer's latitude falls in: positive latitudes are
 * `northern`, negative latitudes `southern`. Returns `null` for the equator
 * (exactly 0) and for non-finite latitudes, where "poleward" has no single
 * direction.
 */
export const hemisphereForLatitude = (latitude: number): Hemisphere | null => {
  if (!Number.isFinite(latitude) || latitude === 0) return null;
  return latitude > 0 ? "northern" : "southern";
};

/** The cardinal compass point toward the nearer geomagnetic pole. */
export type PolewardCompassPoint = "N" | "S";

/**
 * The compass point an observer faces to look poleward: `N` from the Northern
 * Hemisphere (toward the north magnetic pole) and `S` from the Southern. This is
 * the direction the auroral oval lies in for any observer equatorward of it.
 */
export const polewardCompassPoint = (hemisphere: Hemisphere): PolewardCompassPoint =>
  hemisphere === "northern" ? "N" : "S";

/**
 * The poleward compass bearing in degrees clockwise from true north: `0` from
 * the Northern Hemisphere and `180` from the Southern. Suitable for orienting a
 * compass rose or an arrow widget toward the aurora.
 */
export const polewardBearingDegrees = (hemisphere: Hemisphere): number =>
  hemisphere === "northern" ? 0 : 180;

/**
 * Where in the sky to look for the aurora: `high` when the oval is roughly
 * overhead and fills much of the sky, `low` when only a glow sits on the
 * poleward horizon.
 */
export type AuroraViewingElevation = "high" | "low";

/**
 * The elevation band to search for a given visibility tier: an `overhead` tier
 * puts the display `high` overhead, a `horizon` tier keeps it `low` on the
 * poleward horizon, and a `none` tier has nothing to look at, so this returns
 * `null`.
 */
export const viewingElevationForChance = (
  chance: AuroraChance
): AuroraViewingElevation | null => {
  if (chance === "overhead") return "high";
  if (chance === "horizon") return "low";
  return null;
};

/**
 * Full lower-case compass-point names, for weaving the poleward direction into
 * panel sentences ("look to the north"). Centralised so every display names the
 * directions identically.
 */
export const POLEWARD_DIRECTION_LABELS: Record<PolewardCompassPoint, string> = {
  N: "north",
  S: "south"
};

/**
 * Short human labels for each {@link AuroraViewingElevation}, for legends and
 * badges.
 */
export const VIEWING_ELEVATION_LABELS: Record<AuroraViewingElevation, string> = {
  high: "High overhead",
  low: "Low on the horizon"
};
