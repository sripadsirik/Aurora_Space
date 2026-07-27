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

/**
 * Westward longitude shift of a satellite's ground track between successive
 * ascending passes, in degrees. Over one orbital period the Earth rotates
 * `period / day * 360` degrees beneath the orbit, so faster (lower) orbits
 * shift their track further west each revolution.
 */
export const getGroundTrackShiftDegrees = (satellite: Satellite): number => {
  const periodSeconds = getOrbitalPeriod(getOrbitParams(satellite).radius);
  return (periodSeconds / SECONDS_PER_DAY) * 360;
};
