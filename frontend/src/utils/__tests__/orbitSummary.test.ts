import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import type { OrbitType } from "../../types/space";
import {
  describeOrbitRegime,
  getGroundTrackShiftDegrees,
  getOrbitalPeriodMinutes,
  getRevolutionsPerDay,
  summarizeOrbit
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

describe("describeOrbitRegime", () => {
  it("returns metadata whose type matches the requested regime", () => {
    const types: OrbitType[] = ["LEO", "MEO", "GEO"];
    for (const type of types) {
      expect(describeOrbitRegime(type).type).toBe(type);
    }
  });

  it("expands each regime abbreviation into a full label", () => {
    expect(describeOrbitRegime("LEO").label).toBe("Low Earth Orbit");
    expect(describeOrbitRegime("MEO").label).toBe("Medium Earth Orbit");
    expect(describeOrbitRegime("GEO").label).toBe("Geostationary Orbit");
  });

  it("provides a non-empty altitude band and usage note for each regime", () => {
    for (const type of ["LEO", "MEO", "GEO"] as OrbitType[]) {
      const info = describeOrbitRegime(type);
      expect(info.altitudeBand.length).toBeGreaterThan(0);
      expect(info.note.length).toBeGreaterThan(0);
    }
  });
});

describe("summarizeOrbit", () => {
  it("agrees with the individual derivation helpers", () => {
    const satellite = makeSatellite({ altitudeKm: 700 });
    const summary = summarizeOrbit(satellite);
    expect(summary.periodMinutes).toBeCloseTo(getOrbitalPeriodMinutes(satellite), 6);
    expect(summary.revolutionsPerDay).toBeCloseTo(getRevolutionsPerDay(satellite), 6);
    expect(summary.groundTrackShiftDegrees).toBeCloseTo(getGroundTrackShiftDegrees(satellite), 6);
  });

  it("carries the regime metadata for the satellite's orbit type", () => {
    const summary = summarizeOrbit(makeSatellite({ orbitType: "MEO", altitudeKm: 20_200 }));
    expect(summary.regime).toEqual(describeOrbitRegime("MEO"));
  });

  it("reports a positive circular orbital velocity", () => {
    const summary = summarizeOrbit(makeSatellite({ altitudeKm: 420 }));
    expect(summary.velocityKms).toBeGreaterThan(7);
    expect(summary.velocityKms).toBeLessThan(8);
  });
});
