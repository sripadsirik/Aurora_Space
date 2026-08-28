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
