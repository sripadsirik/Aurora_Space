import { describe, expect, it } from "vitest";
import {
  MAGNETOPAUSE_STANDOFF_COEFFICIENT_RE,
  SOLAR_WIND_DYNAMIC_PRESSURE_FACTOR,
  magnetopauseStandoffRe,
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

describe("magnetopauseStandoffRe", () => {
  it("equals the coefficient at unit pressure", () => {
    expect(magnetopauseStandoffRe(1)).toBeCloseTo(MAGNETOPAUSE_STANDOFF_COEFFICIENT_RE, 10);
  });

  it("sits near 9.6 R_E for a nominal 2 nPa stream", () => {
    expect(magnetopauseStandoffRe(2)).toBeCloseTo(9.57, 2);
  });

  it("shrinks as the dynamic pressure rises", () => {
    expect(magnetopauseStandoffRe(10)).toBeLessThan(magnetopauseStandoffRe(2));
  });

  it("follows the -1/6 power law between two pressures", () => {
    const ratio = magnetopauseStandoffRe(4) / magnetopauseStandoffRe(1);
    expect(ratio).toBeCloseTo(Math.pow(4, -1 / 6), 10);
  });

  it("stays finite for a zero or negative pressure", () => {
    expect(Number.isFinite(magnetopauseStandoffRe(0))).toBe(true);
    expect(Number.isFinite(magnetopauseStandoffRe(-5))).toBe(true);
  });
});
