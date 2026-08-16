import { describe, expect, it } from "vitest";
import { clamp, clamp01 } from "../clamp";

describe("clamp", () => {
  it("returns the value untouched when it is inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to the lower bound when below the range", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("clamps to the upper bound when above the range", () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it("treats reversed bounds as the same interval", () => {
    expect(clamp(5, 10, 0)).toBe(5);
    expect(clamp(-1, 10, 0)).toBe(0);
    expect(clamp(20, 10, 0)).toBe(10);
  });

  it("returns the shared bound when min equals max", () => {
    expect(clamp(7, 3, 3)).toBe(3);
  });
});

describe("clamp01", () => {
  it("passes through values already in the unit interval", () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
  });

  it("clamps values outside the unit interval to its bounds", () => {
    expect(clamp01(-0.4)).toBe(0);
    expect(clamp01(1.7)).toBe(1);
  });
});
