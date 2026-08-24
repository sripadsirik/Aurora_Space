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
