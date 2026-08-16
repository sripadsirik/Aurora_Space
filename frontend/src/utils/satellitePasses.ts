import type { Satellite } from "../types/space";
import { earthCentralAngleDeg } from "./coverageFootprint";

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
