import { Ellipsoid } from "cesium";
import { describe, expect, it } from "vitest";
import {
  auroraRadiusMeters,
  circularOrbitalVelocityKms,
  earthRadiusMeters,
  getOrbitalPeriod,
  kpToAuroraBoundaryLatitude,
  kpToAuroraRadiusDegrees
} from "../orbit";

describe("getOrbitalPeriod", () => {
  it("matches the ~90 minute period of a low Earth orbit", () => {
    // ISS altitude ~420 km -> orbital radius ~6.79e6 m
    const period = getOrbitalPeriod(earthRadiusMeters + 420_000);
    expect(period / 60).toBeGreaterThan(88);
    expect(period / 60).toBeLessThan(94);
  });

  it("matches the ~24 hour period of a geostationary orbit", () => {
    const period = getOrbitalPeriod(42_164_000);
    expect(period / 3600).toBeGreaterThan(23.5);
    expect(period / 3600).toBeLessThan(24.5);
  });

  it("increases monotonically with orbital radius", () => {
    expect(getOrbitalPeriod(8_000_000)).toBeGreaterThan(getOrbitalPeriod(7_000_000));
  });
});

describe("circularOrbitalVelocityKms", () => {
  it("matches the ~7.66 km/s speed of a low Earth orbit", () => {
    const speed = circularOrbitalVelocityKms(earthRadiusMeters + 420_000);
    expect(speed).toBeGreaterThan(7.5);
    expect(speed).toBeLessThan(7.8);
  });

  it("matches the ~3.07 km/s speed of a geostationary orbit", () => {
    const speed = circularOrbitalVelocityKms(42_164_000);
    expect(speed).toBeGreaterThan(3.0);
    expect(speed).toBeLessThan(3.15);
  });

  it("decreases as orbital radius grows", () => {
    expect(circularOrbitalVelocityKms(8_000_000)).toBeLessThan(circularOrbitalVelocityKms(7_000_000));
  });
});

describe("earthRadiusMeters", () => {
  it("equals the WGS84 maximum radius", () => {
    expect(earthRadiusMeters).toBe(Ellipsoid.WGS84.maximumRadius);
  });
});

describe("kpToAuroraRadiusDegrees", () => {
  it("clamps values below Kp 4 to the minimum radius", () => {
    expect(kpToAuroraRadiusDegrees(0)).toBe(20);
    expect(kpToAuroraRadiusDegrees(4)).toBe(20);
  });

  it("clamps values above Kp 9 to the maximum radius", () => {
    expect(kpToAuroraRadiusDegrees(9)).toBe(40);
    expect(kpToAuroraRadiusDegrees(12)).toBe(40);
  });

  it("interpolates linearly between the clamp bounds", () => {
    expect(kpToAuroraRadiusDegrees(6.5)).toBeCloseTo(30, 6);
  });
});

describe("kpToAuroraBoundaryLatitude", () => {
  it("keeps the boundary near the pole for quiet conditions", () => {
    expect(kpToAuroraBoundaryLatitude(0)).toBe(90);
  });

  it("pushes the boundary equatorward as Kp rises", () => {
    expect(kpToAuroraBoundaryLatitude(5)).toBeCloseTo(62.5, 6);
  });

  it("clamps the boundary to the 35 degree floor at high Kp", () => {
    expect(kpToAuroraBoundaryLatitude(9)).toBe(40.5);
    expect(kpToAuroraBoundaryLatitude(12)).toBe(35);
  });
});

describe("auroraRadiusMeters", () => {
  it("scales the degree radius onto the Earth's surface", () => {
    const base = auroraRadiusMeters(9);
    expect(base).toBeGreaterThan(0);
  });

  it("applies the multiplier proportionally", () => {
    expect(auroraRadiusMeters(9, 2)).toBeCloseTo(auroraRadiusMeters(9) * 2, 3);
  });
});
