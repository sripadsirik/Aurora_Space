import type { Satellite } from "../types/space";
import { getOrbitParams, getOrbitalPeriod } from "./orbit";

const SECONDS_PER_DAY = 86_400;

/**
 * Orbital period of a satellite in minutes, derived from the deterministic
 * orbit radius that `getOrbitParams` builds from its altitude.
 */
export const getOrbitalPeriodMinutes = (satellite: Satellite): number =>
  getOrbitalPeriod(getOrbitParams(satellite).radius) / 60;
