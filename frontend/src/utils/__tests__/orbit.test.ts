import { Cartesian3, Math as CesiumMath, Ellipsoid } from "cesium";
import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import { getOrbitalPeriod } from "../orbit";

const EARTH_RADIUS_METERS = Ellipsoid.WGS84.maximumRadius;

const makeSatellite = (overrides: Partial<Satellite> = {}): Satellite => ({
  noradId: 25544,
  name: "TEST",
  lat: 0,
  lon: 0,
  altitudeKm: 420,
  velocityKms: 7.6,
  orbitType: "LEO",
  riskLevel: "nominal",
  owner: "TEST",
  conjunctionCount: 0,
  ...overrides
});

describe("getOrbitalPeriod", () => {
  it("returns the ~92 minute period of a low Earth orbit", () => {
    const period = getOrbitalPeriod(EARTH_RADIUS_METERS + 420_000);
    expect(period / 60).toBeGreaterThan(88);
    expect(period / 60).toBeLessThan(94);
  });

  it("returns the ~24 hour period of a geostationary orbit", () => {
    const period = getOrbitalPeriod(42_164_000);
    expect(period / 3600).toBeGreaterThan(23.5);
    expect(period / 3600).toBeLessThan(24.5);
  });

  it("grows monotonically with orbit radius", () => {
    const low = getOrbitalPeriod(EARTH_RADIUS_METERS + 500_000);
    const high = getOrbitalPeriod(EARTH_RADIUS_METERS + 20_000_000);
    expect(high).toBeGreaterThan(low);
  });

  it("scales as the 3/2 power of radius per Kepler's third law", () => {
    const base = getOrbitalPeriod(10_000_000);
    const quadrupled = getOrbitalPeriod(40_000_000);
    // Quadrupling the radius multiplies the period by 4^1.5 = 8.
    expect(quadrupled / base).toBeCloseTo(8, 5);
  });
});
