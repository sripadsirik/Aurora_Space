import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import {
  EARTH_RADIUS_KM,
  coverageAreaKm2,
  coverageRadiusKm,
  earthCentralAngleDeg,
  earthCoverageFraction,
  slantRangeToHorizonKm
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

describe("slantRangeToHorizonKm", () => {
  it("matches the tangent-line geometry sqrt((R+h)^2 - R^2) at the horizon", () => {
    const altitude = 550;
    const expected = Math.sqrt((EARTH_RADIUS_KM + altitude) ** 2 - EARTH_RADIUS_KM ** 2);
    expect(slantRangeToHorizonKm(altitude)).toBeCloseTo(expected, 3);
  });

  it("always exceeds the satellite altitude", () => {
    expect(slantRangeToHorizonKm(550)).toBeGreaterThan(550);
    expect(slantRangeToHorizonKm(35_786)).toBeGreaterThan(35_786);
  });

  it("shortens as the minimum elevation angle rises", () => {
    expect(slantRangeToHorizonKm(550, 20)).toBeLessThan(slantRangeToHorizonKm(550, 0));
  });
});

describe("coverageAreaKm2", () => {
  const EARTH_SURFACE_KM2 = 4 * Math.PI * EARTH_RADIUS_KM ** 2;

  it("never exceeds the total surface area of Earth", () => {
    expect(coverageAreaKm2(35_786)).toBeLessThan(EARTH_SURFACE_KM2);
  });

  it("matches the fraction of Earth times its surface area", () => {
    const fraction = (1 - Math.cos((earthCentralAngleDeg(550) * Math.PI) / 180)) / 2;
    expect(coverageAreaKm2(550)).toBeCloseTo(fraction * EARTH_SURFACE_KM2, 3);
  });

  it("grows with altitude", () => {
    expect(coverageAreaKm2(1200)).toBeGreaterThan(coverageAreaKm2(400));
  });
});

describe("earthCoverageFraction", () => {
  it("sees roughly 42 percent of Earth from geostationary orbit", () => {
    const fraction = earthCoverageFraction(35_786);
    expect(fraction).toBeGreaterThan(0.4);
    expect(fraction).toBeLessThan(0.44);
  });

  it("stays within the 0 to 1 range", () => {
    expect(earthCoverageFraction(400)).toBeGreaterThan(0);
    expect(earthCoverageFraction(400)).toBeLessThan(1);
  });

  it("covers a smaller share of Earth as the elevation limit rises", () => {
    expect(earthCoverageFraction(550, 15)).toBeLessThan(earthCoverageFraction(550, 0));
  });
});
