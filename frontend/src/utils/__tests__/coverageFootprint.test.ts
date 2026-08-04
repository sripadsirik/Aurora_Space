import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import {
  EARTH_RADIUS_KM,
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
