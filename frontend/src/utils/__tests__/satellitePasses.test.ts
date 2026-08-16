import { describe, expect, it } from "vitest";
import { earthCentralAngleDeg } from "../coverageFootprint";
import { maxPassSweepDeg } from "../satellitePasses";

describe("maxPassSweepDeg", () => {
  it("is twice the Earth central angle to the coverage edge", () => {
    expect(maxPassSweepDeg(550)).toBeCloseTo(2 * earthCentralAngleDeg(550), 10);
    expect(maxPassSweepDeg(20200)).toBeCloseTo(2 * earthCentralAngleDeg(20200), 10);
  });

  it("grows with altitude for a fixed elevation mask", () => {
    expect(maxPassSweepDeg(2000)).toBeGreaterThan(maxPassSweepDeg(400));
    expect(maxPassSweepDeg(35786)).toBeGreaterThan(maxPassSweepDeg(2000));
  });

  it("shrinks as the minimum elevation mask rises", () => {
    expect(maxPassSweepDeg(550, 10)).toBeLessThan(maxPassSweepDeg(550, 0));
    expect(maxPassSweepDeg(550, 25)).toBeLessThan(maxPassSweepDeg(550, 10));
  });

  it("stays within the physical 0-180 degree range", () => {
    const sweep = maxPassSweepDeg(35786);
    expect(sweep).toBeGreaterThan(0);
    expect(sweep).toBeLessThan(180);
  });
});
