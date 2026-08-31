import { Cartesian3 } from "cesium";
import { describe, expect, it } from "vitest";
import { createBezierArcPositions } from "../bezierArc";

const start = new Cartesian3(0, 0, 0);
const control = new Cartesian3(10, 10, 0);
const end = new Cartesian3(20, 0, 0);

describe("createBezierArcPositions", () => {
  it("returns intermediatePoints + 2 points including both endpoints", () => {
    expect(createBezierArcPositions(start, control, end, 1)).toHaveLength(3);
    expect(createBezierArcPositions(start, control, end, 8)).toHaveLength(10);
  });

  it("starts exactly at start and ends exactly at end", () => {
    const points = createBezierArcPositions(start, control, end, 4);
    expect(points[0].equals(start)).toBe(true);
    expect(points[points.length - 1].equals(end)).toBe(true);
  });

  it("evaluates the quadratic midpoint at t = 0.5", () => {
    const [, mid] = createBezierArcPositions(start, control, end, 1);
    // 0.25*start + 0.5*control + 0.25*end
    expect(mid.x).toBeCloseTo(10, 10);
    expect(mid.y).toBeCloseTo(5, 10);
    expect(mid.z).toBeCloseTo(0, 10);
  });

  it("bends toward the control point, staying off the straight chord", () => {
    const [, mid] = createBezierArcPositions(start, control, end, 1);
    // The straight chord from start to end has y = 0 everywhere; the curve lifts.
    expect(mid.y).toBeGreaterThan(0);
  });

  it("stays on the chord when the control point is colinear with the endpoints", () => {
    const colinearControl = new Cartesian3(10, 0, 0);
    const points = createBezierArcPositions(start, colinearControl, end, 3);
    points.forEach((point) => expect(point.y).toBeCloseTo(0, 10));
  });
});
