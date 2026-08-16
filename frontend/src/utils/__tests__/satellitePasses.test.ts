import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import { earthCentralAngleDeg } from "../coverageFootprint";
import { getOrbitParams, getOrbitalPeriod } from "../orbit";
import { maxPassDurationSeconds, maxPassSweepDeg } from "../satellitePasses";

const makeSatellite = (overrides: Partial<Satellite> = {}): Satellite => ({
  noradId: 1,
  name: "TEST",
  lat: 0,
  lon: 0,
  altitudeKm: 550,
  velocityKms: 7.6,
  orbitType: "LEO",
  riskLevel: "nominal",
  owner: "TEST",
  conjunctionCount: 0,
  ...overrides
});

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

describe("maxPassDurationSeconds", () => {
  it("equals the sweep fraction of the orbital period", () => {
    const satellite = makeSatellite({ altitudeKm: 550 });
    const period = getOrbitalPeriod(getOrbitParams(satellite).radius);
    const expected = (maxPassSweepDeg(550) / 360) * period;
    expect(maxPassDurationSeconds(satellite)).toBeCloseTo(expected, 6);
  });

  it("gives a low Earth orbit a horizon pass of a few to ~15 minutes", () => {
    const minutes = maxPassDurationSeconds(makeSatellite({ altitudeKm: 550 })) / 60;
    expect(minutes).toBeGreaterThan(5);
    expect(minutes).toBeLessThan(25);
  });

  it("yields a shorter pass under a stricter elevation mask", () => {
    const satellite = makeSatellite({ altitudeKm: 550 });
    expect(maxPassDurationSeconds(satellite, 10)).toBeLessThan(maxPassDurationSeconds(satellite, 0));
  });

  it("grows with altitude as both cap and period widen", () => {
    const low = maxPassDurationSeconds(makeSatellite({ altitudeKm: 400 }));
    const high = maxPassDurationSeconds(makeSatellite({ altitudeKm: 1200 }));
    expect(high).toBeGreaterThan(low);
  });
});
