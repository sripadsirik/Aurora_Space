import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import {
  ECLIPSE_EARTH_RADIUS_KM,
  eclipseCutoffBetaDeg,
  eclipseDurationMinutes,
  eclipseFraction,
  maxEclipseFraction,
  summarizeEclipse,
  sunlightDurationMinutes,
  sunlightFraction
} from "../eclipse";

const GEO_ALTITUDE_KM = 35_786;

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

describe("eclipseFraction", () => {
  it("puts a 550 km orbit in shadow for roughly 37 percent of each orbit", () => {
    const fraction = eclipseFraction(550);
    expect(fraction).toBeGreaterThan(0.35);
    expect(fraction).toBeLessThan(0.4);
  });

  it("puts a geostationary orbit in shadow for under 5 percent of each orbit", () => {
    const fraction = eclipseFraction(GEO_ALTITUDE_KM);
    expect(fraction).toBeGreaterThan(0.04);
    expect(fraction).toBeLessThan(0.05);
  });

  it("shrinks as the beta angle rises", () => {
    expect(eclipseFraction(550, 45)).toBeLessThan(eclipseFraction(550, 0));
  });

  it("returns zero once the beta angle reaches the cutoff", () => {
    const cutoff = eclipseCutoffBetaDeg(550);
    expect(eclipseFraction(550, cutoff)).toBeCloseTo(0, 6);
    expect(eclipseFraction(550, cutoff + 5)).toBe(0);
  });

  it("never exceeds one half", () => {
    expect(eclipseFraction(200)).toBeLessThanOrEqual(0.5);
  });
});
