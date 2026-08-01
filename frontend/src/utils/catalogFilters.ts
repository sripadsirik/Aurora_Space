import type { OrbitType, RiskLevel, Satellite } from "../types/space";

/**
 * Returns the satellites in the given orbit regime. The input is not mutated, so
 * it is safe to call on store state.
 */
export const filterByOrbitType = (satellites: Satellite[], orbitType: OrbitType): Satellite[] =>
  satellites.filter((satellite) => satellite.orbitType === orbitType);

/**
 * Returns the satellites carrying exactly the given risk level. The input is not
 * mutated, so it is safe to call on store state.
 */
export const filterByRiskLevel = (satellites: Satellite[], riskLevel: RiskLevel): Satellite[] =>
  satellites.filter((satellite) => satellite.riskLevel === riskLevel);

/**
 * Returns the satellites belonging to the given owner. The match is
 * case-insensitive and ignores surrounding whitespace so that display strings
 * and query strings compare cleanly. The input is not mutated.
 */
export const filterByOwner = (satellites: Satellite[], owner: string): Satellite[] => {
  const target = owner.trim().toLowerCase();
  return satellites.filter((satellite) => satellite.owner.trim().toLowerCase() === target);
};

/**
 * Returns the satellites whose altitude falls within the inclusive
 * `[minKm, maxKm]` band. Bounds may be supplied in either order; they are
 * normalised so a swapped pair still yields the expected range. The input is not
 * mutated.
 */
export const filterByAltitudeRange = (
  satellites: Satellite[],
  minKm: number,
  maxKm: number
): Satellite[] => {
  const low = Math.min(minKm, maxKm);
  const high = Math.max(minKm, maxKm);
  return satellites.filter(
    (satellite) => satellite.altitudeKm >= low && satellite.altitudeKm <= high
  );
};

/**
 * Case-insensitive free-text search over the catalog. Matches when the query is
 * a substring of a satellite's name or a prefix-free substring of its NORAD id
 * rendered as a string, so `"25544"` and `"544"` both find object 25544. A blank
 * query returns the catalog unchanged. The input is not mutated.
 */
export const searchCatalog = (satellites: Satellite[], query: string): Satellite[] => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [...satellites];
  return satellites.filter((satellite) => {
    if (satellite.name.toLowerCase().includes(needle)) return true;
    return satellite.noradId.toString().includes(needle);
  });
};
