import type { OrbitType, RiskLevel, Satellite } from "../types/space";

/**
 * Returns the satellites in the given orbit regime. The input is not mutated, so
 * it is safe to call on store state.
 */
export const filterByOrbitType = (satellites: Satellite[], orbitType: OrbitType): Satellite[] =>
  satellites.filter((satellite) => satellite.orbitType === orbitType);
