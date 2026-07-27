import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import {
  getGroundTrackShiftDegrees,
  getOrbitalPeriodMinutes,
  getRevolutionsPerDay
} from "../orbitSummary";

const makeSatellite = (overrides: Partial<Satellite> = {}): Satellite => ({
  noradId: 1,
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

describe("getOrbitalPeriodMinutes", () => {
  it("matches the ~92 minute period of a low Earth orbit", () => {
    const period = getOrbitalPeriodMinutes(makeSatellite({ altitudeKm: 420 }));
    expect(period).toBeGreaterThan(88);
    expect(period).toBeLessThan(94);
  });

  it("matches the ~24 hour period of a geostationary orbit", () => {
    const period = getOrbitalPeriodMinutes(makeSatellite({ altitudeKm: 35_786, orbitType: "GEO" }));
    expect(period / 60).toBeGreaterThan(23.5);
    expect(period / 60).toBeLessThan(24.5);
  });

  it("grows with altitude", () => {
    const low = getOrbitalPeriodMinutes(makeSatellite({ altitudeKm: 400 }));
    const high = getOrbitalPeriodMinutes(makeSatellite({ altitudeKm: 1200 }));
    expect(high).toBeGreaterThan(low);
  });
});

describe("getRevolutionsPerDay", () => {
  it("returns about one revolution per day for a geostationary orbit", () => {
    const revs = getRevolutionsPerDay(makeSatellite({ altitudeKm: 35_786, orbitType: "GEO" }));
    expect(revs).toBeGreaterThan(0.97);
    expect(revs).toBeLessThan(1.03);
  });

  it("returns roughly 15-16 revolutions per day for a low Earth orbit", () => {
    const revs = getRevolutionsPerDay(makeSatellite({ altitudeKm: 420 }));
    expect(revs).toBeGreaterThan(15);
    expect(revs).toBeLessThan(16);
  });

  it("is the reciprocal of the orbital period expressed per day", () => {
    const satellite = makeSatellite({ altitudeKm: 800 });
    const periodDays = getOrbitalPeriodMinutes(satellite) / (60 * 24);
    expect(getRevolutionsPerDay(satellite)).toBeCloseTo(1 / periodDays, 6);
  });
});

describe("getGroundTrackShiftDegrees", () => {
  it("shifts a geostationary track by close to a full 360 degrees per orbit", () => {
    const shift = getGroundTrackShiftDegrees(makeSatellite({ altitudeKm: 35_786, orbitType: "GEO" }));
    expect(shift).toBeGreaterThan(350);
    expect(shift).toBeLessThan(370);
  });

  it("shifts a low Earth orbit track by roughly 22-24 degrees per orbit", () => {
    const shift = getGroundTrackShiftDegrees(makeSatellite({ altitudeKm: 420 }));
    expect(shift).toBeGreaterThan(22);
    expect(shift).toBeLessThan(24);
  });

  it("scales with the revolutions-per-day figure to cover 360 degrees per day", () => {
    const satellite = makeSatellite({ altitudeKm: 550 });
    const perDay = getGroundTrackShiftDegrees(satellite) * getRevolutionsPerDay(satellite);
    expect(perDay).toBeCloseTo(360, 6);
  });
});
