import { describe, expect, it } from "vitest";
import { sparklinePoints, sparklineY } from "../sparkline";

describe("sparklineY", () => {
  it("maps the minimum to the bottom edge and the maximum to the top edge", () => {
    expect(sparklineY(0, { height: 40, min: 0, max: 10 })).toBe(40);
    expect(sparklineY(10, { height: 40, min: 0, max: 10 })).toBe(0);
  });

  it("places a mid-range value at the vertical centre", () => {
    expect(sparklineY(5, { height: 40, min: 0, max: 10 })).toBe(20);
  });

  it("clamps values outside the range to the nearest edge", () => {
    expect(sparklineY(-5, { height: 40, min: 0, max: 10 })).toBe(40);
    expect(sparklineY(15, { height: 40, min: 0, max: 10 })).toBe(0);
  });

  it("defaults min to zero when omitted", () => {
    expect(sparklineY(5, { height: 40, max: 10 })).toBe(20);
  });

  it("collapses a zero-width range to the bottom edge", () => {
    expect(sparklineY(7, { height: 40, min: 7, max: 7 })).toBe(40);
  });
});

describe("sparklinePoints", () => {
  it("spreads points evenly across the full width", () => {
    const points = sparklinePoints([0, 5, 10], { width: 100, height: 40, min: 0, max: 10 });
    expect(points.map((p) => p.x)).toEqual([0, 50, 100]);
  });

  it("carries the source value alongside each coordinate", () => {
    const points = sparklinePoints([2, 8], { width: 10, height: 40, min: 0, max: 10 });
    expect(points.map((p) => p.value)).toEqual([2, 8]);
    expect(points[0].y).toBe(sparklineY(2, { height: 40, min: 0, max: 10 }));
  });

  it("defaults max to the largest value in the series", () => {
    const points = sparklinePoints([0, 4], { width: 10, height: 40 });
    expect(points[1].y).toBe(0);
  });

  it("pins a single-element series to x = 0", () => {
    const points = sparklinePoints([5], { width: 100, height: 40, max: 10 });
    expect(points).toHaveLength(1);
    expect(points[0].x).toBe(0);
  });

  it("returns no points for an empty series", () => {
    expect(sparklinePoints([], { width: 100, height: 40 })).toEqual([]);
  });
});
