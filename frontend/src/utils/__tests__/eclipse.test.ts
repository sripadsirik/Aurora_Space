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

describe("sunlightFraction", () => {
  it("is the exact complement of the eclipse fraction", () => {
    expect(sunlightFraction(550, 20)).toBeCloseTo(1 - eclipseFraction(550, 20), 12);
  });

  it("is a full orbit of sunlight past the cutoff beta angle", () => {
    const cutoff = eclipseCutoffBetaDeg(GEO_ALTITUDE_KM);
    expect(sunlightFraction(GEO_ALTITUDE_KM, cutoff + 1)).toBe(1);
  });

  it("stays at or above one half", () => {
    expect(sunlightFraction(200)).toBeGreaterThanOrEqual(0.5);
  });
});

describe("maxEclipseFraction", () => {
  it("equals the beta-zero eclipse fraction", () => {
    expect(maxEclipseFraction(550)).toBe(eclipseFraction(550, 0));
  });

  it("is never smaller than the eclipse fraction at any other beta angle", () => {
    expect(maxEclipseFraction(550)).toBeGreaterThanOrEqual(eclipseFraction(550, 30));
  });

  it("falls as altitude rises", () => {
    expect(maxEclipseFraction(GEO_ALTITUDE_KM)).toBeLessThan(maxEclipseFraction(550));
  });
});

describe("eclipseCutoffBetaDeg", () => {
  it("matches asin(R / (R + h)) for a 550 km orbit", () => {
    const orbitRadius = ECLIPSE_EARTH_RADIUS_KM + 550;
    const expected = (Math.asin(ECLIPSE_EARTH_RADIUS_KM / orbitRadius) * 180) / Math.PI;
    expect(eclipseCutoffBetaDeg(550)).toBeCloseTo(expected, 9);
  });

  it("is under 9 degrees for a geostationary orbit", () => {
    const cutoff = eclipseCutoffBetaDeg(GEO_ALTITUDE_KM);
    expect(cutoff).toBeGreaterThan(8);
    expect(cutoff).toBeLessThan(9);
  });

  it("shrinks with altitude", () => {
    expect(eclipseCutoffBetaDeg(GEO_ALTITUDE_KM)).toBeLessThan(eclipseCutoffBetaDeg(550));
  });
});

describe("eclipseDurationMinutes and sunlightDurationMinutes", () => {
  it("sums to the full orbital period", () => {
    const total = eclipseDurationMinutes(550) + sunlightDurationMinutes(550);
    expect(total).toBeCloseTo(sunlightDurationMinutes(550, eclipseCutoffBetaDeg(550) + 1), 6);
  });

  it("puts a 550 km orbit in shadow for around half an hour", () => {
    const minutes = eclipseDurationMinutes(550);
    expect(minutes).toBeGreaterThan(30);
    expect(minutes).toBeLessThan(40);
  });

  it("keeps a geostationary orbit in shadow for a little over an hour", () => {
    const minutes = eclipseDurationMinutes(GEO_ALTITUDE_KM);
    expect(minutes).toBeGreaterThan(60);
    expect(minutes).toBeLessThan(75);
  });

  it("leaves an orbit fully sunlit past the cutoff", () => {
    const cutoff = eclipseCutoffBetaDeg(550);
    expect(eclipseDurationMinutes(550, cutoff + 5)).toBe(0);
  });
});
