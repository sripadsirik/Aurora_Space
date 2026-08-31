import { Cartesian3 } from "cesium";

/**
 * Samples a quadratic Bézier curve through 3D space as a list of points. The
 * curve starts at `start`, ends at `end`, and bends toward the `control` point
 * without necessarily passing through it. `intermediatePoints` sets how many
 * samples fall strictly between the endpoints, so the returned array always has
 * `intermediatePoints + 2` points — both endpoints plus the interior samples.
 * Used to draw smoothly curved arcs (for example a CME's leading edge) rather
 * than straight polylines.
 */
export const createBezierArcPositions = (
  start: Cartesian3,
  control: Cartesian3,
  end: Cartesian3,
  intermediatePoints = 8
): Cartesian3[] => {
  const segments = intermediatePoints + 1;
  const positions: Cartesian3[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const u = 1 - t;
    positions.push(new Cartesian3(
      u * u * start.x + 2 * u * t * control.x + t * t * end.x,
      u * u * start.y + 2 * u * t * control.y + t * t * end.y,
      u * u * start.z + 2 * u * t * control.z + t * t * end.z
    ));
  }

  return positions;
};
