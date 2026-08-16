import type { Satellite } from "../types/space";
import { earthCentralAngleDeg } from "./coverageFootprint";
import { getOrbitParams, getOrbitalPeriod } from "./orbit";

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
