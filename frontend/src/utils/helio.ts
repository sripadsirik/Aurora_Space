import { Cartesian3, Math as CesiumMath, PolygonHierarchy } from "cesium";

export const HELIO_AU_SCENE_UNITS = 30_000_000;
export const HELIO_ORBIT_RADII = {
  venus: HELIO_AU_SCENE_UNITS * 0.723,
  earth: HELIO_AU_SCENE_UNITS,
  mars: HELIO_AU_SCENE_UNITS * 1.524
} as const;
export const HELIO_SUN_RADIUS = 2_200_000;
export const HELIO_SUN_GLOW_RADIUS = 5_600_000;
export const HELIO_L1_OFFSET = HELIO_AU_SCENE_UNITS * 0.01;
export const HELIO_CME_DURATION_SECONDS = 72 * 3600;
export const HELIO_CME_SPEED = HELIO_ORBIT_RADII.earth / HELIO_CME_DURATION_SECONDS;
export const HELIO_CME_MAX_RADIUS = HELIO_ORBIT_RADII.mars * 1.05;
export const HELIO_CME_HALF_ANGLE = CesiumMath.toRadians(18);
export const HELIO_CAMERA_DESTINATION = new Cartesian3(
  -HELIO_AU_SCENE_UNITS * 0.12,
  -HELIO_AU_SCENE_UNITS * 0.08,
  HELIO_AU_SCENE_UNITS * 3.05
);
export const HELIO_CAMERA_PITCH = CesiumMath.toRadians(-86);

const HELIO_REFERENCE_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

const getUtcElapsedDays = (date: Date): number => (date.getTime() - HELIO_REFERENCE_EPOCH_MS) / 86_400_000;

export const getHelioOrbitAngle = (date: Date, orbitalPeriodDays: number, phase = -CesiumMath.PI_OVER_TWO): number =>
  phase + (getUtcElapsedDays(date) / orbitalPeriodDays) * CesiumMath.TWO_PI;

export const positionOnHelioOrbit = (radius: number, angle: number, result?: Cartesian3): Cartesian3 => {
  const target = result ?? new Cartesian3();
  target.x = Math.cos(angle) * radius;
  target.y = Math.sin(angle) * radius;
  target.z = 0;
  return target;
};

export const createOrbitRingPositions = (radius: number, segments = 192): Cartesian3[] => {
  const positions: Cartesian3[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * CesiumMath.TWO_PI;
    positions.push(positionOnHelioOrbit(radius, angle));
  }

  return positions;
};

export const createOrbitArcPositions = (
  radius: number,
  centralAngle: number,
  halfAngle: number,
  segments = 48
): Cartesian3[] => {
  const positions: Cartesian3[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const angle = centralAngle - halfAngle + t * halfAngle * 2;
    positions.push(positionOnHelioOrbit(radius, angle));
  }

  return positions;
};

export const createSectorHierarchy = (radius: number, centralAngle: number, halfAngle: number, segments = 48): PolygonHierarchy => {
  const positions: Cartesian3[] = [new Cartesian3(0, 0, 0)];

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const angle = centralAngle - halfAngle + t * halfAngle * 2;
    positions.push(positionOnHelioOrbit(radius, angle));
  }

  return new PolygonHierarchy(positions);
};

export const createHelioBandHierarchy = (
  centralAngle: number,
  startRadius: number,
  endRadius: number,
  halfWidth: number
): PolygonHierarchy => {
  const cos = Math.cos(centralAngle);
  const sin = Math.sin(centralAngle);
  const nx = -sin;
  const ny = cos;

  return new PolygonHierarchy([
    new Cartesian3(cos * startRadius + nx * halfWidth, sin * startRadius + ny * halfWidth, 0),
    new Cartesian3(cos * endRadius + nx * halfWidth * 0.78, sin * endRadius + ny * halfWidth * 0.78, 0),
    new Cartesian3(cos * endRadius - nx * halfWidth * 0.78, sin * endRadius - ny * halfWidth * 0.78, 0),
    new Cartesian3(cos * startRadius - nx * halfWidth, sin * startRadius - ny * halfWidth, 0)
  ]);
};

export const getHelioCmeRadius = (elapsedSeconds: number): number =>
  (elapsedSeconds * HELIO_CME_SPEED) % HELIO_CME_MAX_RADIUS;

export const getHelioRemainingSeconds = (elapsedSeconds: number): number =>
  Math.max(0, HELIO_CME_DURATION_SECONDS - elapsedSeconds);

export const formatHelioArrivalLabel = (elapsedSeconds: number): string => {
  const remainingSeconds = getHelioRemainingSeconds(elapsedSeconds);
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = Math.floor(remainingSeconds % 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
};
