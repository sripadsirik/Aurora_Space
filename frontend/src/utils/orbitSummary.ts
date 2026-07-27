import type { OrbitType, Satellite } from "../types/space";
import { circularOrbitalVelocityKms, getOrbitParams, getOrbitalPeriod } from "./orbit";

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
 * `period / day * 360` degrees eastward beneath the orbit, so slower (higher)
 * orbits accumulate a larger westward shift per revolution.
 */
export const getGroundTrackShiftDegrees = (satellite: Satellite): number => {
  const periodSeconds = getOrbitalPeriod(getOrbitParams(satellite).radius);
  return (periodSeconds / SECONDS_PER_DAY) * 360;
};

/** Descriptive metadata for an orbit regime (LEO / MEO / GEO). */
export interface OrbitRegimeInfo {
  type: OrbitType;
  /** Expanded name of the regime. */
  label: string;
  /** Typical altitude band for the regime. */
  altitudeBand: string;
  /** One-line note on how the regime is commonly used. */
  note: string;
}

const orbitRegimes: Record<OrbitType, OrbitRegimeInfo> = {
  LEO: {
    type: "LEO",
    label: "Low Earth Orbit",
    altitudeBand: "160-2000 km",
    note: "Earth observation, imaging, and crewed stations with short periods."
  },
  MEO: {
    type: "MEO",
    label: "Medium Earth Orbit",
    altitudeBand: "2000-35786 km",
    note: "Navigation constellations such as GPS and Galileo."
  },
  GEO: {
    type: "GEO",
    label: "Geostationary Orbit",
    altitudeBand: "~35786 km",
    note: "Communications and weather satellites fixed over one longitude."
  }
};

/** Returns the descriptive metadata for an orbit regime. */
export const describeOrbitRegime = (type: OrbitType): OrbitRegimeInfo => orbitRegimes[type];

/** Derived orbital characteristics for a single satellite. */
export interface OrbitSummary {
  periodMinutes: number;
  revolutionsPerDay: number;
  groundTrackShiftDegrees: number;
  velocityKms: number;
  regime: OrbitRegimeInfo;
}

/**
 * Bundles the derived orbital figures for a satellite into a single summary:
 * period, revolutions per day, ground-track shift, circular orbital speed, and
 * regime metadata. All values come from the same deterministic orbit radius so
 * they stay mutually consistent.
 */
export const summarizeOrbit = (satellite: Satellite): OrbitSummary => {
  const { radius } = getOrbitParams(satellite);
  const periodSeconds = getOrbitalPeriod(radius);
  return {
    periodMinutes: periodSeconds / 60,
    revolutionsPerDay: SECONDS_PER_DAY / periodSeconds,
    groundTrackShiftDegrees: (periodSeconds / SECONDS_PER_DAY) * 360,
    velocityKms: circularOrbitalVelocityKms(radius),
    regime: describeOrbitRegime(satellite.orbitType)
  };
};
