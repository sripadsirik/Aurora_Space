import { Cartesian3, Cartographic, Math as CesiumMath } from "cesium";
import { describe, expect, it } from "vitest";
import { AURORA_CAP_POINT_COUNT, AURORA_CAP_WOBBLE, createAuroraCapHierarchy } from "../auroraCap";

const latitudesDeg = (positions: Cartesian3[]): number[] =>
  positions.map((position) => CesiumMath.toDegrees(Cartographic.fromCartesian(position).latitude));

describe("createAuroraCapHierarchy", () => {
  it("closes the ring with point count + 1 vertices", () => {
    const hierarchy = createAuroraCapHierarchy(true, 20);
    expect(hierarchy.positions).toHaveLength(AURORA_CAP_POINT_COUNT + 1);
  });

  it("honours a custom point count", () => {
    const hierarchy = createAuroraCapHierarchy(true, 20, 12);
    expect(hierarchy.positions).toHaveLength(13);
  });

  it("keeps the northern cap in the northern hemisphere", () => {
    const lats = latitudesDeg(createAuroraCapHierarchy(true, 20).positions);
    for (const lat of lats) {
      expect(lat).toBeGreaterThan(0);
    }
  });

  it("mirrors the southern cap into the southern hemisphere", () => {
    const lats = latitudesDeg(createAuroraCapHierarchy(false, 20).positions);
    for (const lat of lats) {
      expect(lat).toBeLessThan(0);
    }
  });

  it("scallops the edge within the wobble amplitude of the nominal radius", () => {
    const radiusDeg = 20;
    const lats = latitudesDeg(createAuroraCapHierarchy(true, radiusDeg).positions);
    const colatitudes = lats.map((lat) => 90 - lat);
    const maxColat = Math.max(...colatitudes);
    const minColat = Math.min(...colatitudes);
    // The scalloped edge oscillates by ±(radius * wobble) around the radius.
    expect(maxColat).toBeCloseTo(radiusDeg * (1 + AURORA_CAP_WOBBLE), 4);
    expect(minColat).toBeCloseTo(radiusDeg * (1 - AURORA_CAP_WOBBLE), 4);
  });
});
