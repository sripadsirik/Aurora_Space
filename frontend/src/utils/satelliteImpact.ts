import type { Satellite } from "../types/space";

/** Qualitative severity of a space-weather impact on a satellite. */
export type ImpactLevel = "LOW" | "MEDIUM" | "HIGH";

export interface SpaceWeatherImpact {
  label: ImpactLevel;
  /** One-line description of the dominant environmental effect. */
  description: string;
}

/**
 * Assesses the dominant space-weather impact on a satellite for a given Kp
 * index. The dominant effect depends on the orbit regime: atmospheric drag for
 * LEO, surface charging for GEO, and radiation environment for MEO. Thresholds
 * escalate LOW → MEDIUM → HIGH as geomagnetic activity increases.
 */
export const getSpaceWeatherImpact = (satellite: Satellite, kpIndex: number): SpaceWeatherImpact => {
  if (satellite.orbitType === "LEO") {
    if (kpIndex >= 6) {
      return { label: "HIGH", description: "Elevated atmospheric drag and orbital decay risk." };
    }
    if (kpIndex >= 4.5) {
      return { label: "MEDIUM", description: "Moderate drag increase from thermospheric heating." };
    }
    return { label: "LOW", description: "Low drag variability expected for current geomagnetic conditions." };
  }

  if (satellite.orbitType === "GEO") {
    if (kpIndex >= 7) {
      return { label: "HIGH", description: "High charging risk from geomagnetic disturbance." };
    }
    if (kpIndex >= 5) {
      return { label: "MEDIUM", description: "Moderate surface charging risk." };
    }
    return { label: "LOW", description: "Charging environment remains relatively stable." };
  }

  if (kpIndex >= 6.5) {
    return { label: "HIGH", description: "Increased radiation environment at MEO altitude." };
  }
  if (kpIndex >= 4.5) {
    return { label: "MEDIUM", description: "Some increased radiation noise possible." };
  }
  return { label: "LOW", description: "Nominal environmental impact expected." };
};
