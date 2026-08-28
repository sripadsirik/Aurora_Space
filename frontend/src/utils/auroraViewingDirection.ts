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

import { classifyAuroraChance, type AuroraChance } from "./auroraVisibility";

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

/**
 * A resolved "where to look" instruction for one observer and one visibility
 * tier, ready to drive a compass widget or a copy string. When there is nothing
 * to see ({@link visible} is `false`) or the observer's hemisphere is unknown,
 * the directional fields are `null`.
 */
export interface AuroraViewingInstruction {
  /** Whether the aurora is visible at all for this tier (not the `none` tier). */
  visible: boolean;
  /** The observer's hemisphere, or `null` on the equator / for a bad latitude. */
  hemisphere: Hemisphere | null;
  /** Compass point to face, or `null` when there is nothing to look toward. */
  compassPoint: PolewardCompassPoint | null;
  /** Compass bearing in degrees clockwise from true north, or `null`. */
  bearingDegrees: number | null;
  /** Elevation band to search, or `null` when the aurora is not visible. */
  elevation: AuroraViewingElevation | null;
}

/**
 * Resolves an observer's latitude and aurora {@link AuroraChance} into a single
 * viewing instruction. The directional fields are populated only when the aurora
 * is visible ({@link viewingElevationForChance} is non-null) and the observer's
 * hemisphere is known; otherwise they stay `null` so a display can fall back to
 * "nothing to see" without special-casing every field.
 */
export const describeAuroraViewing = (
  latitude: number,
  chance: AuroraChance
): AuroraViewingInstruction => {
  const hemisphere = hemisphereForLatitude(latitude);
  const elevation = viewingElevationForChance(chance);
  const visible = elevation !== null;
  const pointable = visible && hemisphere !== null;
  return {
    visible,
    hemisphere,
    compassPoint: pointable ? polewardCompassPoint(hemisphere) : null,
    bearingDegrees: pointable ? polewardBearingDegrees(hemisphere) : null,
    elevation
  };
};

/**
 * Resolves a viewing instruction straight from a planetary Kp reading and an
 * observer latitude, deriving the visibility tier via
 * {@link classifyAuroraChance} before handing off to {@link describeAuroraViewing}.
 * A convenience for callers that hold a raw Kp value rather than a pre-computed
 * {@link AuroraChance}.
 */
export const viewingFromKp = (
  kp: number,
  latitude: number
): AuroraViewingInstruction =>
  describeAuroraViewing(latitude, classifyAuroraChance(kp, latitude));
