import { Cartesian3, Math as CesiumMath } from "cesium";
import { describe, expect, it } from "vitest";
import { createOrbitRingPositions, getHelioOrbitAngle, positionOnHelioOrbit } from "../helio";

describe("getHelioOrbitAngle", () => {
  const J2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));

  it("returns the phase at the J2000 reference epoch", () => {
    const phase = -CesiumMath.PI_OVER_TWO;
    expect(getHelioOrbitAngle(J2000, 365.25, phase)).toBeCloseTo(phase, 10);
  });

  it("advances a full turn after one orbital period", () => {
    const phase = 0;
    const oneYearLater = new Date(J2000.getTime() + 365.25 * 86_400_000);
    expect(getHelioOrbitAngle(oneYearLater, 365.25, phase)).toBeCloseTo(CesiumMath.TWO_PI, 8);
  });

  it("advances half a turn after half a period", () => {
    const halfLater = new Date(J2000.getTime() + (687 / 2) * 86_400_000);
    expect(getHelioOrbitAngle(halfLater, 687, 0)).toBeCloseTo(Math.PI, 8);
  });

  it("winds backwards for dates before the epoch", () => {
    const oneYearBefore = new Date(J2000.getTime() - 365.25 * 86_400_000);
    expect(getHelioOrbitAngle(oneYearBefore, 365.25, 0)).toBeCloseTo(-CesiumMath.TWO_PI, 8);
  });

  it("defaults the phase to a quarter turn behind", () => {
    expect(getHelioOrbitAngle(J2000, 365.25)).toBeCloseTo(-CesiumMath.PI_OVER_TWO, 10);
  });
});

describe("positionOnHelioOrbit", () => {
  it("places angle 0 on the +x axis at the given radius", () => {
    const point = positionOnHelioOrbit(1000, 0);
    expect(point.x).toBeCloseTo(1000, 6);
    expect(point.y).toBeCloseTo(0, 6);
    expect(point.z).toBe(0);
  });

  it("places a quarter turn on the +y axis", () => {
    const point = positionOnHelioOrbit(1000, Math.PI / 2);
    expect(point.x).toBeCloseTo(0, 6);
    expect(point.y).toBeCloseTo(1000, 6);
  });

  it("keeps the orbit flat in the z = 0 plane", () => {
    expect(positionOnHelioOrbit(500, 1.3).z).toBe(0);
  });

  it("stays at the orbit radius from the Sun", () => {
    const point = positionOnHelioOrbit(2500, 2.1);
    expect(Math.hypot(point.x, point.y)).toBeCloseTo(2500, 6);
  });

  it("reuses the provided result Cartesian to avoid allocation", () => {
    const result = new Cartesian3();
    const returned = positionOnHelioOrbit(700, 0, result);
    expect(returned).toBe(result);
    expect(result.x).toBeCloseTo(700, 6);
  });
});

describe("createOrbitRingPositions", () => {
  it("returns segments + 1 points so the ring closes", () => {
    expect(createOrbitRingPositions(1000, 64)).toHaveLength(65);
  });

  it("defaults to 192 segments", () => {
    expect(createOrbitRingPositions(1000)).toHaveLength(193);
  });

  it("closes the loop by ending where it started", () => {
    const positions = createOrbitRingPositions(1500, 32);
    const first = positions[0];
    const last = positions[positions.length - 1];
    expect(last.x).toBeCloseTo(first.x, 6);
    expect(last.y).toBeCloseTo(first.y, 6);
  });

  it("keeps every point on the ring radius in the z = 0 plane", () => {
    for (const point of createOrbitRingPositions(2000, 16)) {
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(2000, 6);
      expect(point.z).toBe(0);
    }
  });
});
