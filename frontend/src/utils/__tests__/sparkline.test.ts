import { describe, expect, it } from "vitest";
import {
  buildSparkline,
  sparklinePath,
  sparklinePoints,
  sparklineThresholdY,
  sparklineY
} from "../sparkline";

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

  it("collapses to the bottom edge when max is omitted", () => {
    expect(sparklineY(5, { height: 40, min: 0 })).toBe(40);
    expect(sparklineY(2, { height: 30, min: 2 })).toBe(30);
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

describe("sparklinePath", () => {
  it("starts with a moveto and links the rest with linetos", () => {
    const path = sparklinePath([
      { x: 0, y: 10, value: 1 },
      { x: 5, y: 20, value: 2 },
      { x: 10, y: 0, value: 3 }
    ]);
    expect(path).toBe("M 0 10 L 5 20 L 10 0");
  });

  it("returns an empty string for no points", () => {
    expect(sparklinePath([])).toBe("");
  });

  it("emits a lone moveto for a single point", () => {
    expect(sparklinePath([{ x: 3, y: 4, value: 9 }])).toBe("M 3 4");
  });
});

describe("buildSparkline", () => {
  it("returns points and a path derived from the same series", () => {
    const options = { width: 10, height: 40, min: 0, max: 10 };
    const { points, path } = buildSparkline([0, 10], options);
    expect(points).toEqual(sparklinePoints([0, 10], options));
    expect(path).toBe(sparklinePath(points));
  });

  it("produces an empty path for an empty series", () => {
    expect(buildSparkline([], { width: 10, height: 40 })).toEqual({ points: [], path: "" });
  });
});

describe("sparklineThresholdY", () => {
  it("positions a reference line on the shared value scale", () => {
    expect(sparklineThresholdY(5, { width: 10, height: 40, min: 0, max: 10 })).toBe(20);
  });

  it("clamps a threshold above the range to the top edge", () => {
    expect(sparklineThresholdY(20, { width: 10, height: 40, min: 0, max: 10 })).toBe(0);
  });
});
