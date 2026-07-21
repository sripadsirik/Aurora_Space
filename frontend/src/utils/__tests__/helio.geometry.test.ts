import { Cartesian3, Math as CesiumMath } from "cesium";
import { describe, expect, it } from "vitest";
import {
  createHelioBandHierarchy,
  createOrbitArcPositions,
  createOrbitRingPositions,
  createSectorHierarchy,
  getHelioOrbitAngle,
  positionOnHelioOrbit
} from "../helio";

const REFERENCE_EPOCH = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));

describe("positionOnHelioOrbit", () => {
  it("places points at the given radius in the z = 0 plane", () => {
    const point = positionOnHelioOrbit(1000, 0);
    expect(point.x).toBeCloseTo(1000, 6);
    expect(point.y).toBeCloseTo(0, 6);
    expect(point.z).toBe(0);
  });

  it("writes into the supplied result object instead of allocating", () => {
    const target = new Cartesian3(1, 1, 1);
    const returned = positionOnHelioOrbit(500, Math.PI / 2, target);
    expect(returned).toBe(target);
    expect(target.x).toBeCloseTo(0, 6);
    expect(target.y).toBeCloseTo(500, 6);
  });
});

describe("getHelioOrbitAngle", () => {
  it("equals the phase offset at the reference epoch", () => {
    expect(getHelioOrbitAngle(REFERENCE_EPOCH, 365.25)).toBeCloseTo(-CesiumMath.PI_OVER_TWO, 6);
  });

  it("advances by a full turn after one orbital period", () => {
    const period = 100;
    const oneLater = new Date(REFERENCE_EPOCH.getTime() + period * 86_400_000);
    const delta = getHelioOrbitAngle(oneLater, period) - getHelioOrbitAngle(REFERENCE_EPOCH, period);
    expect(delta).toBeCloseTo(CesiumMath.TWO_PI, 6);
  });

  it("honours a custom phase", () => {
    expect(getHelioOrbitAngle(REFERENCE_EPOCH, 365.25, 0)).toBeCloseTo(0, 6);
  });
});

describe("createOrbitRingPositions", () => {
  it("returns segments + 1 points", () => {
    expect(createOrbitRingPositions(1000, 64)).toHaveLength(65);
  });

  it("keeps every point at the ring radius", () => {
    for (const point of createOrbitRingPositions(1234, 16)) {
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(1234, 3);
    }
  });
});

describe("createOrbitArcPositions", () => {
  it("spans the arc symmetrically around the central angle", () => {
    const positions = createOrbitArcPositions(1000, 0, CesiumMath.toRadians(30), 4);
    expect(positions).toHaveLength(5);
    const startAngle = Math.atan2(positions[0].y, positions[0].x);
    const endAngle = Math.atan2(positions[positions.length - 1].y, positions[positions.length - 1].x);
    expect(startAngle).toBeCloseTo(-CesiumMath.toRadians(30), 5);
    expect(endAngle).toBeCloseTo(CesiumMath.toRadians(30), 5);
  });
});

describe("createSectorHierarchy", () => {
  it("starts at the origin and fans out over segments + 1 points", () => {
    const hierarchy = createSectorHierarchy(1000, 0, 0.3, 8);
    expect(hierarchy.positions).toHaveLength(10);
    expect(hierarchy.positions[0].x).toBe(0);
    expect(hierarchy.positions[0].y).toBe(0);
  });
});

describe("createHelioBandHierarchy", () => {
  it("produces a four-cornered quad", () => {
    const hierarchy = createHelioBandHierarchy(0, 1000, 2000, 100);
    expect(hierarchy.positions).toHaveLength(4);
    expect(hierarchy.positions.every((p) => p.z === 0)).toBe(true);
  });
});
