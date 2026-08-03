import type { Satellite } from "../types/space";

/**
 * Altitude cut-offs (in kilometres) that separate the geomagnetic-storm exposure
 * regimes. Objects below `leoCeilingKm` feel enhanced atmospheric drag as a storm
 * heats and expands the thermosphere, while objects above `geoFloorKm` sit in the
 * high-charging environment near geostationary altitude.
 */
export const STORM_EXPOSURE_THRESHOLDS = {
  leoCeilingKm: 2000,
  geoFloorKm: 35000
} as const;

/** The catalog owner label used for untracked debris objects. */
export const DEBRIS_OWNER = "DEBRIS";

/** Count of catalog objects exposed to each geomagnetic-storm risk mechanism. */
export interface StormExposureCounts {
  /** Low-orbit objects at risk of increased atmospheric drag. */
  leoDrag: number;
  /** High-altitude objects at risk of surface charging near GEO. */
  geoCharging: number;
  /** Debris objects at risk of accelerated orbital decay. */
  debris: number;
}

/**
 * Tallies how many catalog objects fall into each geomagnetic-storm exposure
 * bucket: low-orbit drag (below {@link STORM_EXPOSURE_THRESHOLDS.leoCeilingKm}),
 * high-altitude charging (above {@link STORM_EXPOSURE_THRESHOLDS.geoFloorKm}), and
 * debris decay ({@link DEBRIS_OWNER}-owned objects). The buckets overlap by design
 * — a single object can be counted in more than one — because each reflects a
 * distinct hazard an operator tracks separately during a storm.
 */
export const countStormExposedAssets = (satellites: readonly Satellite[]): StormExposureCounts => {
  const counts: StormExposureCounts = { leoDrag: 0, geoCharging: 0, debris: 0 };
  for (const satellite of satellites) {
    if (satellite.altitudeKm < STORM_EXPOSURE_THRESHOLDS.leoCeilingKm) counts.leoDrag += 1;
    if (satellite.altitudeKm > STORM_EXPOSURE_THRESHOLDS.geoFloorKm) counts.geoCharging += 1;
    if (satellite.owner === DEBRIS_OWNER) counts.debris += 1;
  }
  return counts;
};
