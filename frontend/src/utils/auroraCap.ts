import { Cartesian3, Math as CesiumMath, PolygonHierarchy } from "cesium";

/** Default number of vertices sampled around an aurora cap's scalloped edge. */
export const AURORA_CAP_POINT_COUNT = 96;

/**
 * Amplitude of the aurora cap's edge wobble as a fraction of its radius. The
 * boundary is scalloped rather than a perfect circle so the glow reads as a
 * living oval; `0.12` gives a gentle ripple.
 */
export const AURORA_CAP_WOBBLE = 0.12;

/**
 * Builds a polar-cap polygon approximating the auroral oval around one pole. The
 * cap spans `radiusDeg` degrees of colatitude from the pole (north when
 * `isNorth`, otherwise south) and its edge is scalloped with a three-lobed
 * wobble so the boundary looks organic rather than a hard circle. `pointCount`
 * vertices are sampled evenly in longitude, closing the ring at the seam.
 */
export const createAuroraCapHierarchy = (
  isNorth: boolean,
  radiusDeg: number,
  pointCount = AURORA_CAP_POINT_COUNT
): PolygonHierarchy => {
  const positions: Cartesian3[] = [];
  const poleSign = isNorth ? 1 : -1;

  for (let index = 0; index <= pointCount; index += 1) {
    const theta = (index / pointCount) * CesiumMath.TWO_PI;
    const wobble = 1 + AURORA_CAP_WOBBLE * Math.sin(theta * 3);
    positions.push(
      Cartesian3.fromDegrees(CesiumMath.toDegrees(theta) - 180, poleSign * (90 - radiusDeg * wobble))
    );
  }

  return new PolygonHierarchy(positions);
};
