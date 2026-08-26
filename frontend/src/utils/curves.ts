import { Cartesian3 } from "cesium";

/**
 * Samples a quadratic Bézier curve through `start` and `end` with `control` as
 * the single off-curve handle, returning `intermediatePoints + 2` points evenly
 * spaced in the curve parameter `t` (endpoints included). Used to draw smooth
 * arced fronts in scene space — the standard `B(t) = (1-t)²·start + 2(1-t)t·control + t²·end`.
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
