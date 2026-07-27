import type { Satellite } from "../types/space";
import { getOrbitParams, getOrbitalPeriod } from "./orbit";

const SECONDS_PER_DAY = 86_400;

/**
 * Orbital period of a satellite in minutes, derived from the deterministic
 * orbit radius that `getOrbitParams` builds from its altitude.
 */
export const getOrbitalPeriodMinutes = (satellite: Satellite): number =>
  getOrbitalPeriod(getOrbitParams(satellite).radius) / 60;

/**
 * Number of full revolutions a satellite completes per 24-hour solar day. This
 * is the "mean motion" figure quoted in TLE catalogs; a geostationary orbit
 * sits at roughly one revolution per day.
 */
export const getRevolutionsPerDay = (satellite: Satellite): number =>
  SECONDS_PER_DAY / getOrbitalPeriod(getOrbitParams(satellite).radius);
