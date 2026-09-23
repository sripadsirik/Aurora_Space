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

describe("createOrbitArcPositions", () => {
  it("returns segments + 1 points", () => {
    expect(createOrbitArcPositions(1000, 0, 0.3, 24)).toHaveLength(25);
  });

  it("starts at centralAngle - halfAngle and ends at centralAngle + halfAngle", () => {
    const radius = 1000;
    const centralAngle = 1;
    const halfAngle = 0.4;
    const positions = createOrbitArcPositions(radius, centralAngle, halfAngle, 10);

    const start = positionOnHelioOrbit(radius, centralAngle - halfAngle);
    const end = positionOnHelioOrbit(radius, centralAngle + halfAngle);
    const first = positions[0];
    const last = positions[positions.length - 1];

    expect(first.x).toBeCloseTo(start.x, 6);
    expect(first.y).toBeCloseTo(start.y, 6);
    expect(last.x).toBeCloseTo(end.x, 6);
    expect(last.y).toBeCloseTo(end.y, 6);
  });

  it("keeps every sampled point on the arc radius", () => {
    for (const point of createOrbitArcPositions(2500, 2, 0.5, 12)) {
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(2500, 6);
    }
  });
});

describe("createSectorHierarchy", () => {
  it("anchors the pie slice at the Sun's centre", () => {
    const { positions } = createSectorHierarchy(1000, 0, 0.3, 16);
    expect(positions[0]).toEqual(new Cartesian3(0, 0, 0));
  });

  it("has the apex plus segments + 1 arc points", () => {
    const { positions } = createSectorHierarchy(1000, 0, 0.3, 16);
    expect(positions).toHaveLength(1 + 17);
  });

  it("keeps the arc points on the sector radius", () => {
    const { positions } = createSectorHierarchy(1800, 1, 0.4, 8);
    for (const point of positions.slice(1)) {
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(1800, 6);
    }
  });

  it("has no inner holes", () => {
    const hierarchy = createSectorHierarchy(1000, 0, 0.3);
    expect(hierarchy.holes).toEqual([]);
  });
});

describe("createHelioBandHierarchy", () => {
  it("builds a flat quadrilateral of four vertices", () => {
    const { positions } = createHelioBandHierarchy(0, 1000, 5000, 200);
    expect(positions).toHaveLength(4);
    for (const point of positions) {
      expect(point.z).toBe(0);
    }
  });

  it("is wider at the start than the tapered outer edge", () => {
    const { positions } = createHelioBandHierarchy(0, 1000, 5000, 200);
    // Along angle 0 the band width runs along the y axis.
    const startWidth = Math.abs(positions[0].y - positions[3].y);
    const endWidth = Math.abs(positions[1].y - positions[2].y);
    expect(startWidth).toBeCloseTo(400, 6);
    expect(endWidth).toBeCloseTo(2 * 200 * 0.78, 6);
    expect(endWidth).toBeLessThan(startWidth);
  });

  it("runs radially from the start radius to the end radius", () => {
    const { positions } = createHelioBandHierarchy(0, 1000, 5000, 200);
    // The x component tracks the radial distance for a band along angle 0.
    expect(positions[0].x).toBeCloseTo(1000, 6);
    expect(positions[1].x).toBeCloseTo(5000, 6);
  });

  it("orients the band along the central angle", () => {
    const centralAngle = Math.PI / 2;
    const { positions } = createHelioBandHierarchy(centralAngle, 1000, 5000, 200);
    // Along a quarter turn the midline points up the y axis.
    expect(positions[0].y).toBeCloseTo(1000, 6);
    expect(positions[1].y).toBeCloseTo(5000, 6);
  });
});
