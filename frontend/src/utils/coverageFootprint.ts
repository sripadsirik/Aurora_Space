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
