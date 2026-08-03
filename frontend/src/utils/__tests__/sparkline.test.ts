import { describe, expect, it } from "vitest";
import { sparklineY } from "../sparkline";

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
