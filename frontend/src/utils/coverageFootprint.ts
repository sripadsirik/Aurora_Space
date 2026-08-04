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

/**
 * Area of Earth's surface, in square kilometres, inside the coverage cap. Uses
 * the spherical-cap area `2 * pi * R^2 * (1 - cos(lambda))`, where `lambda` is
 * the Earth central angle to the coverage edge.
 */
export const coverageAreaKm2 = (altitudeKm: number, minElevationDeg = 0): number => {
  const centralAngle = toRadians(earthCentralAngleDeg(altitudeKm, minElevationDeg));
  return 2 * Math.PI * EARTH_RADIUS_KM ** 2 * (1 - Math.cos(centralAngle));
};

/**
 * Fraction of Earth's total surface area that falls inside the coverage cap, in
 * the range 0-1. Equal to `(1 - cos(lambda)) / 2`. A single geostationary
 * satellite sees roughly 0.42 (about 42%) of the globe down to the horizon.
 */
export const earthCoverageFraction = (altitudeKm: number, minElevationDeg = 0): number => {
  const centralAngle = toRadians(earthCentralAngleDeg(altitudeKm, minElevationDeg));
  return (1 - Math.cos(centralAngle)) / 2;
};

/** Derived ground coverage figures for a single satellite. */
export interface CoverageFootprint {
  /** Minimum ground elevation angle the footprint was computed for, in degrees. */
  minElevationDeg: number;
  /** Earth central angle from the sub-point to the coverage edge, in degrees. */
  centralAngleDeg: number;
  /** Surface radius of the coverage circle, in kilometres. */
  coverageRadiusKm: number;
  /** Line-of-sight range to the coverage edge, in kilometres. */
  slantRangeKm: number;
  /** Surface area inside the coverage cap, in square kilometres. */
  coverageAreaKm2: number;
  /** Fraction of Earth's surface inside the coverage cap, 0-1. */
  earthFraction: number;
}

/**
 * Bundles the derived coverage figures for a satellite into a single footprint:
 * central angle, surface radius, slant range, cap area, and the fraction of
 * Earth in view. All values come from the satellite's altitude and the given
 * minimum elevation angle, so they stay mutually consistent.
 */
export const getCoverageFootprint = (
  satellite: Satellite,
  minElevationDeg = 0
): CoverageFootprint => ({
  minElevationDeg,
  centralAngleDeg: earthCentralAngleDeg(satellite.altitudeKm, minElevationDeg),
  coverageRadiusKm: coverageRadiusKm(satellite.altitudeKm, minElevationDeg),
  slantRangeKm: slantRangeToHorizonKm(satellite.altitudeKm, minElevationDeg),
  coverageAreaKm2: coverageAreaKm2(satellite.altitudeKm, minElevationDeg),
  earthFraction: earthCoverageFraction(satellite.altitudeKm, minElevationDeg)
});
