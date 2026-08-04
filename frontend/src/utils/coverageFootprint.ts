import type { Satellite } from "../types/space";

/** Mean Earth radius in kilometres (spherical approximation). */
export const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/**
 * Earth central angle, in degrees, between a satellite's sub-point and the edge
 * of the area it can serve for a given minimum ground elevation angle. At the
 * default `minElevationDeg` of 0 this is the geometric horizon: the largest
 * central angle at which the satellite is still above the local horizon.
 *
 * Higher orbits and lower elevation limits both widen the visible cap, so the
 * central angle grows with altitude and shrinks as the elevation limit rises.
 */
export const earthCentralAngleDeg = (altitudeKm: number, minElevationDeg = 0): number => {
  const epsilon = toRadians(minElevationDeg);
  const ratio = EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm);
  return toDegrees(Math.acos(ratio * Math.cos(epsilon)) - epsilon);
};

/**
 * Radius of the ground coverage circle, in kilometres, measured as the arc
 * length along Earth's surface from the sub-satellite point to the coverage
 * edge. Derived directly from the central angle, so it grows with altitude and
 * shrinks as the minimum elevation angle rises.
 */
export const coverageRadiusKm = (altitudeKm: number, minElevationDeg = 0): number =>
  EARTH_RADIUS_KM * toRadians(earthCentralAngleDeg(altitudeKm, minElevationDeg));

/**
 * Line-of-sight (slant) range in kilometres from the satellite to the edge of
 * its coverage cap. Computed with the law of cosines on the triangle formed by
 * Earth's centre, the satellite, and the coverage-edge ground point. At the
 * default horizon this is the maximum distance at which a receiver can still
 * see the satellite.
 */
export const slantRangeToHorizonKm = (altitudeKm: number, minElevationDeg = 0): number => {
  const satelliteRadius = EARTH_RADIUS_KM + altitudeKm;
  const centralAngle = toRadians(earthCentralAngleDeg(altitudeKm, minElevationDeg));
  const squared =
    EARTH_RADIUS_KM ** 2 +
    satelliteRadius ** 2 -
    2 * EARTH_RADIUS_KM * satelliteRadius * Math.cos(centralAngle);
  return Math.sqrt(squared);
};
