import { Cartesian3 } from "cesium";
import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import {
  createOrbitPositions,
  earthRadiusMeters,
  getOrbitParams,
  getSatellitePositionOnOrbit,
  orbitPoint
} from "../orbit";

const makeSatellite = (overrides: Partial<Satellite> = {}): Satellite => ({
  noradId: 25544,
  name: "TEST",
  lat: 0,
  lon: 0,
  altitudeKm: 420,
  velocityKms: 7.66,
  orbitType: "LEO",
  riskLevel: "nominal",
  owner: "TEST",
  conjunctionCount: 0,
  ...overrides
});

describe("getOrbitParams", () => {
  it("derives orbital radius from altitude above the Earth's surface", () => {
    const { radius } = getOrbitParams(makeSatellite({ altitudeKm: 500 }));
    expect(radius).toBeCloseTo(earthRadiusMeters + 500_000, 3);
  });

  it("produces a deterministic inclination and ascending node from the norad id", () => {
    const params = getOrbitParams(makeSatellite());
    expect(getOrbitParams(makeSatellite())).toEqual(params);
    expect(params.inclination).toBeGreaterThan(0);
  });

  it("keeps the ascending node within a single revolution", () => {
    const { ascendingNode } = getOrbitParams(makeSatellite({ noradId: 99999 }));
    expect(ascendingNode).toBeGreaterThanOrEqual(0);
    expect(ascendingNode).toBeLessThan(2 * Math.PI);
  });
});

describe("orbitPoint", () => {
  const magnitude = (p: Cartesian3) => Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);

  it("always lies at the orbital radius from the origin", () => {
    const radius = 7_000_000;
    for (const theta of [0, 1, Math.PI / 2, Math.PI, 4]) {
      expect(magnitude(orbitPoint(theta, radius, 0.6, 1.2))).toBeCloseTo(radius, 2);
    }
  });

  it("stays in the equatorial plane at zero inclination", () => {
    expect(orbitPoint(1.1, 7_000_000, 0, 0.5).z).toBeCloseTo(0, 6);
  });

  it("returns a Cartesian3 instance", () => {
    expect(orbitPoint(0, 7_000_000, 0, 0)).toBeInstanceOf(Cartesian3);
  });
});

describe("createOrbitPositions", () => {
  it("returns segments + 1 points so the ring closes", () => {
    expect(createOrbitPositions(makeSatellite(), 60)).toHaveLength(61);
  });

  it("defaults to 181 points", () => {
    expect(createOrbitPositions(makeSatellite())).toHaveLength(181);
  });

  it("closes the loop back to the starting point", () => {
    const positions = createOrbitPositions(makeSatellite(), 36);
    const first = positions[0];
    const last = positions[positions.length - 1];
    expect(last.x).toBeCloseTo(first.x, 2);
    expect(last.y).toBeCloseTo(first.y, 2);
    expect(last.z).toBeCloseTo(first.z, 2);
  });
});

describe("getSatellitePositionOnOrbit", () => {
  it("returns a point on the orbit at the satellite's radius", () => {
    const satellite = makeSatellite({ altitudeKm: 550 });
    const { radius } = getOrbitParams(satellite);
    const point = getSatellitePositionOnOrbit(satellite);
    const mag = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
    expect(mag).toBeCloseTo(radius, 2);
  });
});
