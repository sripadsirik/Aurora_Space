import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import {
  EARTH_RADIUS_KM,
  coverageRadiusKm,
  earthCentralAngleDeg
} from "../coverageFootprint";

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

describe("earthCentralAngleDeg", () => {
  it("returns roughly 23 degrees at the horizon for a 550 km orbit", () => {
    const angle = earthCentralAngleDeg(550);
    expect(angle).toBeGreaterThan(22);
    expect(angle).toBeLessThan(24);
  });

  it("returns about 81 degrees at the horizon for a geostationary orbit", () => {
    const angle = earthCentralAngleDeg(35_786);
    expect(angle).toBeGreaterThan(80);
    expect(angle).toBeLessThan(82);
  });

  it("grows with altitude", () => {
    expect(earthCentralAngleDeg(1200)).toBeGreaterThan(earthCentralAngleDeg(400));
  });

  it("shrinks as the minimum elevation angle rises", () => {
    expect(earthCentralAngleDeg(550, 10)).toBeLessThan(earthCentralAngleDeg(550, 0));
  });
});

describe("coverageRadiusKm", () => {
  it("is the central angle in radians scaled by Earth's radius", () => {
    const angleRad = (earthCentralAngleDeg(550) * Math.PI) / 180;
    expect(coverageRadiusKm(550)).toBeCloseTo(EARTH_RADIUS_KM * angleRad, 6);
  });

  it("returns a coverage radius around 2500 km for a 550 km orbit", () => {
    const radius = coverageRadiusKm(550);
    expect(radius).toBeGreaterThan(2400);
    expect(radius).toBeLessThan(2700);
  });

  it("grows with altitude", () => {
    expect(coverageRadiusKm(1200)).toBeGreaterThan(coverageRadiusKm(400));
  });
});
