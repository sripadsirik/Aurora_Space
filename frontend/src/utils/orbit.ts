import { Cartesian3, Math as CesiumMath, Ellipsoid } from "cesium";
import type { Satellite } from "../types/space";

const EARTH_RADIUS_METERS = Ellipsoid.WGS84.maximumRadius;

const toRadians = CesiumMath.toRadians;

// GM for Earth (m^3/s^2)
const MU_EARTH = 3.986004418e14;

/**
 * Derives a deterministic orbit radius, inclination, and ascending node for a
 * satellite from its altitude, orbit type, and NORAD id. Values are stable per
 * satellite so orbit rings stay consistent between renders.
 */
export const getOrbitParams = (satellite: Satellite) => {
  const radius = EARTH_RADIUS_METERS + satellite.altitudeKm * 1000;
  const inclinationDeg =
    satellite.orbitType === "LEO"
      ? 40 + (satellite.noradId % 58)
      : satellite.orbitType === "MEO"
        ? 50 + (satellite.noradId % 10)
        : 2 + (satellite.noradId % 6);

  const inclination = toRadians(inclinationDeg);
  const ascendingNode = toRadians((satellite.noradId * 13) % 360);

  return { radius, inclination, ascendingNode };
};

/** Orbital period in seconds using Kepler's third law */
export const getOrbitalPeriod = (radiusMeters: number): number =>
  2 * Math.PI * Math.sqrt((radiusMeters ** 3) / MU_EARTH);

/**
 * Circular orbital speed in km/s for a given orbit radius, from the vis-viva
 * relation `v = sqrt(mu / r)`. Faster orbits sit at smaller radii.
 */
export const circularOrbitalVelocityKms = (radiusMeters: number): number =>
  Math.sqrt(MU_EARTH / radiusMeters) / 1000;

/**
 * Computes the ECEF-style position of a point at true anomaly `theta` on a
 * circular orbit with the given radius, inclination, and ascending node.
 */
export const orbitPoint = (theta: number, radius: number, inclination: number, ascendingNode: number): Cartesian3 => {
  const x = radius * Math.cos(theta);
  const y = radius * Math.sin(theta);

  const yInclined = y * Math.cos(inclination);
  const zInclined = y * Math.sin(inclination);

  const xRotated = x * Math.cos(ascendingNode) - yInclined * Math.sin(ascendingNode);
  const yRotated = x * Math.sin(ascendingNode) + yInclined * Math.cos(ascendingNode);

  return new Cartesian3(xRotated, yRotated, zInclined);
};

/** Samples a full closed orbit ring for a satellite as `segments + 1` points. */
export const createOrbitPositions = (satellite: Satellite, segments = 180): Cartesian3[] => {
  const { radius, inclination, ascendingNode } = getOrbitParams(satellite);
  const positions: Cartesian3[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const theta = (index / segments) * CesiumMath.TWO_PI;
    positions.push(orbitPoint(theta, radius, inclination, ascendingNode));
  }

  return positions;
};

/** Returns the satellite's current position along its orbit, derived from its longitude. */
export const getSatellitePositionOnOrbit = (satellite: Satellite): Cartesian3 => {
  const { radius, inclination, ascendingNode } = getOrbitParams(satellite);
  // Use the satellite's longitude to derive its position along the orbit
  const theta = toRadians(satellite.lon + 180);
  return orbitPoint(theta, radius, inclination, ascendingNode);
};

/**
 * Maps a Kp index to the auroral oval's angular radius in degrees. Kp is clamped
 * to 4-9, mapping linearly onto a 20-40 degree radius from the geomagnetic pole.
 */
export const kpToAuroraRadiusDegrees = (kpIndex: number): number => {
  const clampedKp = Math.max(4, Math.min(9, kpIndex));
  return 20 + ((clampedKp - 4) / 5) * 20;
};

/** Converts the auroral oval radius for a Kp index into metres along Earth's surface. */
export const auroraRadiusMeters = (kpIndex: number, multiplier = 1): number => {
  const radiusDegrees = kpToAuroraRadiusDegrees(kpIndex) * multiplier;
  return EARTH_RADIUS_METERS * CesiumMath.toRadians(radiusDegrees);
};

export const earthRadiusMeters = EARTH_RADIUS_METERS;
