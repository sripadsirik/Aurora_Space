import { Cartesian3, Math as CesiumMath, Ellipsoid } from "cesium";
import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import {
  auroraRadiusMeters,
  circularOrbitalVelocityKms,
  createOrbitPositions,
  earthRadiusMeters,
  getOrbitParams,
  getOrbitalPeriod,
  getSatellitePositionOnOrbit,
  kpToAuroraBoundaryLatitude,
  kpToAuroraRadiusDegrees,
  orbitPoint,
  orbitThetaAtElapsed
} from "../orbit";

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

describe("getOrbitParams", () => {
  it("derives the radius from Earth's radius plus the satellite altitude", () => {
    const { radius } = getOrbitParams(makeSatellite({ altitudeKm: 550 }));
    expect(radius).toBeCloseTo(EARTH_RADIUS_METERS + 550_000, 3);
  });

  it("is deterministic for a given satellite", () => {
    const satellite = makeSatellite({ noradId: 12345, altitudeKm: 780 });
    expect(getOrbitParams(satellite)).toEqual(getOrbitParams(satellite));
  });

  it("keeps LEO inclinations within the 40-97 degree band", () => {
    for (let noradId = 0; noradId < 58; noradId += 1) {
      const { inclination } = getOrbitParams(makeSatellite({ noradId, orbitType: "LEO" }));
      const degrees = CesiumMath.toDegrees(inclination);
      expect(degrees).toBeGreaterThanOrEqual(40);
      expect(degrees).toBeLessThanOrEqual(97);
    }
  });

  it("gives GEO satellites a near-equatorial inclination", () => {
    const { inclination } = getOrbitParams(makeSatellite({ orbitType: "GEO", noradId: 5 }));
    expect(CesiumMath.toDegrees(inclination)).toBeLessThanOrEqual(8);
  });

  it("keeps the ascending node within a full revolution", () => {
    const { ascendingNode } = getOrbitParams(makeSatellite({ noradId: 999 }));
    expect(ascendingNode).toBeGreaterThanOrEqual(0);
    expect(ascendingNode).toBeLessThan(CesiumMath.TWO_PI);
  });
});

describe("createOrbitPositions", () => {
  it("returns segments + 1 points so the ring closes", () => {
    const positions = createOrbitPositions(makeSatellite(), 90);
    expect(positions).toHaveLength(91);
  });

  it("closes the loop by ending where it started", () => {
    const positions = createOrbitPositions(makeSatellite(), 120);
    const first = positions[0];
    const last = positions[positions.length - 1];
    expect(last.x).toBeCloseTo(first.x, 3);
    expect(last.y).toBeCloseTo(first.y, 3);
    expect(last.z).toBeCloseTo(first.z, 3);
  });

  it("keeps every sampled point at the orbit radius", () => {
    const satellite = makeSatellite({ altitudeKm: 1200 });
    const { radius } = getOrbitParams(satellite);
    for (const point of createOrbitPositions(satellite, 36)) {
      expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(radius, 2);
    }
  });
});

describe("getSatellitePositionOnOrbit", () => {
  it("returns a point on the satellite's orbit radius", () => {
    const satellite = makeSatellite({ lon: 42, altitudeKm: 600 });
    const { radius } = getOrbitParams(satellite);
    const position = getSatellitePositionOnOrbit(satellite);
    expect(Math.hypot(position.x, position.y, position.z)).toBeCloseTo(radius, 2);
  });

  it("returns a Cartesian3 instance", () => {
    expect(getSatellitePositionOnOrbit(makeSatellite())).toBeInstanceOf(Cartesian3);
  });
});

describe("kpToAuroraRadiusDegrees", () => {
  it("maps the Kp 4 floor to a 20 degree radius", () => {
    expect(kpToAuroraRadiusDegrees(4)).toBeCloseTo(20, 6);
  });

  it("maps the Kp 9 ceiling to a 40 degree radius", () => {
    expect(kpToAuroraRadiusDegrees(9)).toBeCloseTo(40, 6);
  });

  it("clamps Kp values below 4 to the 20 degree floor", () => {
    expect(kpToAuroraRadiusDegrees(0)).toBeCloseTo(20, 6);
    expect(kpToAuroraRadiusDegrees(-3)).toBeCloseTo(20, 6);
  });

  it("clamps Kp values above 9 to the 40 degree ceiling", () => {
    expect(kpToAuroraRadiusDegrees(12)).toBeCloseTo(40, 6);
  });

  it("interpolates linearly between the endpoints", () => {
    // Kp 6.5 is the midpoint of the 4-9 range, so the radius is the 20-40 mid.
    expect(kpToAuroraRadiusDegrees(6.5)).toBeCloseTo(30, 6);
  });
});

describe("kpToAuroraBoundaryLatitude", () => {
  it("keeps the boundary at the pole for a quiet Kp 0", () => {
    expect(kpToAuroraBoundaryLatitude(0)).toBeCloseTo(90, 6);
  });

  it("drops the boundary ~5.5 degrees per whole Kp step", () => {
    expect(kpToAuroraBoundaryLatitude(4)).toBeCloseTo(68, 6);
  });

  it("pushes the aurora to mid-latitudes for a strong storm", () => {
    const latitude = kpToAuroraBoundaryLatitude(8);
    expect(latitude).toBeGreaterThanOrEqual(35);
    expect(latitude).toBeLessThan(50);
  });

  it("never falls below the 35 degree floor", () => {
    expect(kpToAuroraBoundaryLatitude(9)).toBeGreaterThanOrEqual(35);
    expect(kpToAuroraBoundaryLatitude(20)).toBe(35);
  });

  it("never exceeds the pole for negative inputs", () => {
    expect(kpToAuroraBoundaryLatitude(-5)).toBe(90);
  });
});

describe("auroraRadiusMeters", () => {
  it("converts the Kp 4 oval radius into metres along the surface", () => {
    const expected = EARTH_RADIUS_METERS * CesiumMath.toRadians(20);
    expect(auroraRadiusMeters(4)).toBeCloseTo(expected, 3);
  });

  it("scales linearly with the multiplier", () => {
    const base = auroraRadiusMeters(6);
    expect(auroraRadiusMeters(6, 2)).toBeCloseTo(base * 2, 3);
  });

  it("grows with a stronger storm", () => {
    expect(auroraRadiusMeters(9)).toBeGreaterThan(auroraRadiusMeters(4));
  });
});

describe("earthRadiusMeters", () => {
  it("exposes the WGS84 maximum radius", () => {
    expect(earthRadiusMeters).toBe(EARTH_RADIUS_METERS);
  });
});
