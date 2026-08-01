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
