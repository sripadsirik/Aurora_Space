import { Cartesian3 } from "cesium";
import { describe, expect, it } from "vitest";
import { createBezierArcPositions } from "../curves";

const start = new Cartesian3(0, 0, 0);
const control = new Cartesian3(10, 20, 0);
const end = new Cartesian3(20, 0, 0);

describe("createBezierArcPositions", () => {
  it("returns intermediatePoints + 2 sampled points", () => {
    expect(createBezierArcPositions(start, control, end, 8)).toHaveLength(10);
    expect(createBezierArcPositions(start, control, end, 0)).toHaveLength(2);
  });

  it("passes through the start and end points exactly", () => {
    const positions = createBezierArcPositions(start, control, end, 8);
    const first = positions[0];
    const last = positions[positions.length - 1];
    expect(first.x).toBeCloseTo(start.x, 9);
    expect(first.y).toBeCloseTo(start.y, 9);
    expect(last.x).toBeCloseTo(end.x, 9);
    expect(last.y).toBeCloseTo(end.y, 9);
  });

  it("bulges toward the control handle at the curve midpoint", () => {
    // At t = 0.5, B = 0.25·start + 0.5·control + 0.25·end.
    // With intermediatePoints = 1 there are 2 segments, so index 1 is exactly t = 0.5.
    const positions = createBezierArcPositions(start, control, end, 1);
    const mid = positions[1];
    expect(mid.x).toBeCloseTo(0.25 * start.x + 0.5 * control.x + 0.25 * end.x, 9);
    expect(mid.y).toBeCloseTo(0.25 * start.y + 0.5 * control.y + 0.25 * end.y, 9);
  });

  it("interpolates the z axis alongside x and y", () => {
    const lifted = createBezierArcPositions(
      new Cartesian3(0, 0, 0),
      new Cartesian3(0, 0, 4),
      new Cartesian3(0, 0, 8),
      1
    );
    expect(lifted[1].z).toBeCloseTo(4, 9);
  });

  it("defaults to eight intermediate points", () => {
    expect(createBezierArcPositions(start, control, end)).toHaveLength(10);
  });
});
