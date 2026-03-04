import { Cartesian3, Math as CesiumMath, Ellipsoid } from "cesium";
import type { Satellite } from "../types/space";

const EARTH_RADIUS_METERS = Ellipsoid.WGS84.maximumRadius;

const toRadians = CesiumMath.toRadians;

export const createOrbitPositions = (satellite: Satellite, segments = 180): Cartesian3[] => {
  const radius = EARTH_RADIUS_METERS + satellite.altitudeKm * 1000;
  const inclinationDeg =
    satellite.orbitType === "LEO"
      ? 40 + (satellite.noradId % 58)
      : satellite.orbitType === "MEO"
        ? 50 + (satellite.noradId % 10)
        : 2 + (satellite.noradId % 6);

  const inclination = toRadians(inclinationDeg);
  const ascendingNode = toRadians((satellite.noradId * 13) % 360);

  const positions: Cartesian3[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const theta = (index / segments) * CesiumMath.TWO_PI;

    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);

    const yInclined = y * Math.cos(inclination);
    const zInclined = y * Math.sin(inclination);

    const xRotated = x * Math.cos(ascendingNode) - yInclined * Math.sin(ascendingNode);
    const yRotated = x * Math.sin(ascendingNode) + yInclined * Math.cos(ascendingNode);

    positions.push(new Cartesian3(xRotated, yRotated, zInclined));
  }

  return positions;
};

export const kpToAuroraRadiusDegrees = (kpIndex: number): number => {
  const clampedKp = Math.max(4, Math.min(9, kpIndex));
  return 20 + ((clampedKp - 4) / 5) * 20;
};

export const auroraRadiusMeters = (kpIndex: number, multiplier = 1): number => {
  const radiusDegrees = kpToAuroraRadiusDegrees(kpIndex) * multiplier;
  return EARTH_RADIUS_METERS * CesiumMath.toRadians(radiusDegrees);
};

export const earthRadiusMeters = EARTH_RADIUS_METERS;
