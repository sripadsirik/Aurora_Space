import { Cartesian3, Math as CesiumMath, Ellipsoid } from "cesium";
import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import { circularOrbitalVelocityKms, getOrbitalPeriod, orbitPoint, orbitThetaAtElapsed } from "../orbit";

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

describe("circularOrbitalVelocityKms", () => {
  it("returns the ~7.7 km/s speed of a low Earth orbit", () => {
    const velocity = circularOrbitalVelocityKms(EARTH_RADIUS_METERS + 420_000);
    expect(velocity).toBeGreaterThan(7.5);
    expect(velocity).toBeLessThan(7.9);
  });

  it("returns the ~3.07 km/s speed of a geostationary orbit", () => {
    const velocity = circularOrbitalVelocityKms(42_164_000);
    expect(velocity).toBeGreaterThan(3.0);
    expect(velocity).toBeLessThan(3.15);
  });

  it("decreases as the orbit radius grows", () => {
    const low = circularOrbitalVelocityKms(EARTH_RADIUS_METERS + 500_000);
    const high = circularOrbitalVelocityKms(EARTH_RADIUS_METERS + 20_000_000);
    expect(high).toBeLessThan(low);
  });

  it("scales as the inverse square root of radius", () => {
    const base = circularOrbitalVelocityKms(10_000_000);
    const quadrupled = circularOrbitalVelocityKms(40_000_000);
    // Quadrupling the radius halves the orbital speed.
    expect(quadrupled / base).toBeCloseTo(0.5, 5);
  });
});

describe("orbitThetaAtElapsed", () => {
  it("returns the initial angle when no time has elapsed past the epoch", () => {
    expect(orbitThetaAtElapsed(1.2, 5400, 100, 100)).toBe(1.2);
  });

  it("advances a full turn after exactly one period", () => {
    const initial = 0.5;
    const period = 5400;
    const theta = orbitThetaAtElapsed(initial, period, 0, period);
    expect(theta).toBeCloseTo(initial + CesiumMath.TWO_PI, 10);
  });

  it("advances half a turn after half a period", () => {
    const theta = orbitThetaAtElapsed(0, 5400, 0, 2700);
    expect(theta).toBeCloseTo(Math.PI, 10);
  });

  it("winds backwards for time before the epoch", () => {
    const theta = orbitThetaAtElapsed(0, 5400, 5400, 0);
    expect(theta).toBeCloseTo(-CesiumMath.TWO_PI, 10);
  });
});

describe("orbitPoint", () => {
  it("places theta 0 of an equatorial orbit on the +x axis at the radius", () => {
    const point = orbitPoint(0, 7_000_000, 0, 0);
    expect(point.x).toBeCloseTo(7_000_000, 3);
    expect(point.y).toBeCloseTo(0, 3);
    expect(point.z).toBeCloseTo(0, 3);
  });

  it("keeps an equatorial (zero inclination) orbit in the z = 0 plane", () => {
    const point = orbitPoint(Math.PI / 3, 7_000_000, 0, 0);
    expect(point.z).toBeCloseTo(0, 6);
  });

  it("lifts the orbit out of plane by the inclination at theta = 90 degrees", () => {
    const radius = 7_000_000;
    const inclination = CesiumMath.toRadians(45);
    const point = orbitPoint(Math.PI / 2, radius, inclination, 0);
    expect(point.z).toBeCloseTo(radius * Math.sin(inclination), 3);
  });

  it("keeps every point at the orbit radius from the origin", () => {
    const radius = 7_000_000;
    const point = orbitPoint(1.1, radius, CesiumMath.toRadians(53), CesiumMath.toRadians(120));
    const magnitude = Math.hypot(point.x, point.y, point.z);
    expect(magnitude).toBeCloseTo(radius, 3);
  });
});
