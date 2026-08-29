import { describe, expect, it } from "vitest";
import {
  SOLAR_WIND_DYNAMIC_PRESSURE_FACTOR,
  solarWindDynamicPressureNPa
} from "../solarWindPressure";

describe("solarWindDynamicPressureNPa", () => {
  it("matches the analytic factor * n * v^2 for a quiet stream", () => {
    const expected = SOLAR_WIND_DYNAMIC_PRESSURE_FACTOR * 5 * 400 * 400;
    expect(solarWindDynamicPressureNPa(5, 400)).toBeCloseTo(expected, 10);
  });

  it("lands near 1.3 nPa for a typical quiet stream", () => {
    expect(solarWindDynamicPressureNPa(5, 400)).toBeCloseTo(1.338, 3);
  });

  it("scales linearly with density", () => {
    const single = solarWindDynamicPressureNPa(3, 500);
    expect(solarWindDynamicPressureNPa(6, 500)).toBeCloseTo(single * 2, 10);
  });

  it("scales with the square of the bulk speed", () => {
    const base = solarWindDynamicPressureNPa(4, 300);
    expect(solarWindDynamicPressureNPa(4, 600)).toBeCloseTo(base * 4, 10);
  });

  it("is zero when the density is zero", () => {
    expect(solarWindDynamicPressureNPa(0, 500)).toBe(0);
  });
});
