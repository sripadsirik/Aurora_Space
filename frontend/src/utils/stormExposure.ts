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
