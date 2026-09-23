import { Cartesian3 } from "cesium";
import { describe, expect, it } from "vitest";
import { CME_FLAME_CONE_SEGMENTS, createFireConeFrontPositions } from "../cmeFlameCone";

const axis = Cartesian3.UNIT_X;
const right = Cartesian3.UNIT_Y;
const up = Cartesian3.UNIT_Z;
const length = 1000;

const front = (timeSeconds: number, segments?: number): Cartesian3[] =>
  createFireConeFrontPositions(axis, right, up, length, 0.4, timeSeconds, 1, 0.1, segments);

describe("createFireConeFrontPositions", () => {
  it("returns segments + 1 samples by default", () => {
    expect(front(0)).toHaveLength(CME_FLAME_CONE_SEGMENTS + 1);
  });

  it("honours a custom segment count", () => {
    expect(front(0, 6)).toHaveLength(7);
  });

  it("keeps every sample within the forward-scale clamp band", () => {
    for (const point of front(1.3)) {
      const magnitude = Math.hypot(point.x, point.y, point.z);
      expect(magnitude).toBeGreaterThanOrEqual(length * 0.62 - 1e-6);
      expect(magnitude).toBeLessThanOrEqual(length * 1.28 + 1e-6);
    }
  });

  it("is deterministic for a fixed time", () => {
    const a = front(2.5);
    const b = front(2.5);
    for (let index = 0; index < a.length; index += 1) {
      expect(a[index].x).toBe(b[index].x);
      expect(a[index].y).toBe(b[index].y);
      expect(a[index].z).toBe(b[index].z);
    }
  });

  it("animates the front as time advances", () => {
    const a = front(0);
    const b = front(1);
    const moved = a.some((point, index) => !Cartesian3.equals(point, b[index]));
    expect(moved).toBe(true);
  });
});
