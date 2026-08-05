import type { Satellite } from "../types/space";

/** Counts of catalogued objects in each storm-exposed asset category. */
export interface StormAssetRiskCounts {
  /** Low Earth orbit objects (below 2000 km) exposed to atmospheric drag. */
  leo: number;
  /** Geostationary-belt objects (above 35000 km) exposed to surface charging. */
  geo: number;
  /** Tracked debris, keyed off the `DEBRIS` owner tag, exposed to orbital decay. */
  debris: number;
}

/**
 * Tallies how many catalogued objects fall into each geomagnetic-storm risk
 * category. The bands are deliberately coarse and non-exclusive — an object can
 * be both LEO and debris — because the storm panel reports each exposure
 * independently rather than partitioning the catalogue.
 */
export const getStormAssetRiskCounts = (satellites: readonly Satellite[]): StormAssetRiskCounts => ({
  leo: satellites.filter((s) => s.altitudeKm < 2000).length,
  geo: satellites.filter((s) => s.altitudeKm > 35000).length,
  debris: satellites.filter((s) => s.owner === "DEBRIS").length
});
