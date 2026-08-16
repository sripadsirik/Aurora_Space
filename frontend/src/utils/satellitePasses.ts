import type { Satellite } from "../types/space";
import { earthCentralAngleDeg, slantRangeToHorizonKm } from "./coverageFootprint";
import { getOrbitParams, getOrbitalPeriod } from "./orbit";
import { getRevolutionsPerDay } from "./orbitSummary";

/**
 * Total arc, in degrees of true anomaly, that a satellite sweeps while above a
 * ground station's horizon during an ideal overhead pass — the geometry that
 * bounds how long a station can talk to the satellite on a single revolution.
 *
 * A pass is longest when the ground track carries the sub-satellite point
 * straight over the station: the satellite rises at one edge of the coverage
 * cap, climbs to the zenith, and sets at the opposite edge, sweeping twice the
 * Earth central angle to the coverage edge. Raising `minElevationDeg` shrinks
 * the usable cap, so a stricter elevation mask always yields a smaller sweep.
 */
export const maxPassSweepDeg = (altitudeKm: number, minElevationDeg = 0): number =>
  2 * earthCentralAngleDeg(altitudeKm, minElevationDeg);

/**
 * Fraction of a full revolution, in the range 0-1, that a satellite spends above
 * a ground station's horizon during an ideal overhead pass — the sweep expressed
 * as a share of the 360° orbit. Multiply by the orbital period for a per-pass
 * contact window, or by a day for the theoretical daily ceiling.
 */
export const passOrbitFraction = (altitudeKm: number, minElevationDeg = 0): number =>
  maxPassSweepDeg(altitudeKm, minElevationDeg) / 360;

/**
 * Longest time, in seconds, that a satellite can stay above a ground station's
 * horizon on a single revolution, for the given minimum elevation mask. The
 * satellite covers the horizon-to-horizon sweep at its mean angular rate, so the
 * duration is the fraction `sweep / 360` of the orbital period.
 *
 * This is an idealised upper bound: it assumes a directly overhead pass and
 * ignores Earth's rotation beneath the orbit, which nudges real passes slightly
 * shorter or longer. It is still the standard first-order figure for sizing the
 * maximum contact window per pass.
 */
export const maxPassDurationSeconds = (satellite: Satellite, minElevationDeg = 0): number => {
  const periodSeconds = getOrbitalPeriod(getOrbitParams(satellite).radius);
  return (maxPassSweepDeg(satellite.altitudeKm, minElevationDeg) / 360) * periodSeconds;
};

/**
 * Longest per-revolution contact window expressed in minutes — the same figure
 * as {@link maxPassDurationSeconds}, rescaled for display next to the
 * minute-based orbital period figures elsewhere in the UI.
 */
export const maxPassDurationMinutes = (satellite: Satellite, minElevationDeg = 0): number =>
  maxPassDurationSeconds(satellite, minElevationDeg) / 60;

/**
 * Theoretical upper bound, in seconds, on the total time a single station could
 * see a satellite across a full day. It assumes the best case that *every*
 * revolution produces a zenith pass of the maximum duration, so it multiplies
 * {@link maxPassDurationSeconds} by the revolutions completed per day.
 *
 * Real stations see only a handful of passes per day and most are off-zenith, so
 * actual contact time is far lower — this figure is a ceiling for capacity
 * planning, not an estimate of a typical day.
 */
export const theoreticalMaxDailyContactSeconds = (
  satellite: Satellite,
  minElevationDeg = 0
): number => maxPassDurationSeconds(satellite, minElevationDeg) * getRevolutionsPerDay(satellite);

/** Derived best-case pass figures for a single satellite over a ground station. */
export interface PassSummary {
  /** Minimum ground elevation angle the pass was computed for, in degrees. */
  minElevationDeg: number;
  /** Horizon-to-horizon true-anomaly arc swept during the pass, in degrees. */
  sweepDeg: number;
  /** Longest per-revolution contact window, in seconds. */
  durationSeconds: number;
  /** Longest per-revolution contact window, in minutes. */
  durationMinutes: number;
  /** Line-of-sight range to the satellite as it crosses the horizon, in kilometres. */
  horizonSlantRangeKm: number;
}

/**
 * Bundles the best-case pass figures for a satellite into a single summary:
 * the elevation mask, horizon-to-horizon sweep, contact duration in seconds and
 * minutes, and the slant range at the horizon. All values derive from the same
 * altitude and orbital period, so they stay mutually consistent — mirroring
 * `summarizeOrbit` and `getCoverageFootprint`.
 */
export const summarizePass = (satellite: Satellite, minElevationDeg = 0): PassSummary => {
  const durationSeconds = maxPassDurationSeconds(satellite, minElevationDeg);
  return {
    minElevationDeg,
    sweepDeg: maxPassSweepDeg(satellite.altitudeKm, minElevationDeg),
    durationSeconds,
    durationMinutes: durationSeconds / 60,
    horizonSlantRangeKm: slantRangeToHorizonKm(satellite.altitudeKm, minElevationDeg)
  };
};
