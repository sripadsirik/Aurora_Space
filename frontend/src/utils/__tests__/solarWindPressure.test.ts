import { describe, expect, it } from "vitest";
import {
  DYNAMIC_PRESSURE_COEFFICIENT,
  solarWindDynamicPressure
} from "../solarWindPressure";

describe("solarWindDynamicPressure", () => {
  it("follows Pdyn = k * n * v^2 for nominal solar wind", () => {
    const expected = DYNAMIC_PRESSURE_COEFFICIENT * 5 * 400 * 400;
    expect(solarWindDynamicPressure(5, 400)).toBeCloseTo(expected, 9);
  });

  it("lands in the typical 1-3 nPa band for quiet conditions", () => {
    const pressure = solarWindDynamicPressure(5, 400);
    expect(pressure).toBeGreaterThan(1);
    expect(pressure).toBeLessThan(3);
  });

  it("scales with the square of the bulk speed", () => {
    const slow = solarWindDynamicPressure(5, 400);
    const fast = solarWindDynamicPressure(5, 800);
    expect(fast).toBeCloseTo(slow * 4, 9);
  });

  it("scales linearly with proton density", () => {
    const sparse = solarWindDynamicPressure(4, 500);
    const dense = solarWindDynamicPressure(12, 500);
    expect(dense).toBeCloseTo(sparse * 3, 9);
  });

  it("is zero when the wind is at rest or has no protons", () => {
    expect(solarWindDynamicPressure(0, 500)).toBe(0);
    expect(solarWindDynamicPressure(5, 0)).toBe(0);
  });

  it("clamps negative inputs to zero rather than returning a negative pressure", () => {
    expect(solarWindDynamicPressure(-5, 400)).toBe(0);
    expect(solarWindDynamicPressure(5, -400)).toBe(0);
  });

  it("returns zero for non-finite inputs instead of NaN", () => {
    expect(solarWindDynamicPressure(Number.NaN, 400)).toBe(0);
    expect(solarWindDynamicPressure(5, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
