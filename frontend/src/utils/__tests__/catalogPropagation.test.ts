import { describe, expect, it } from "vitest";
import { Cartesian3 } from "cesium";
import { mockSatellites } from "../../data/mock/satellites";
import { propagateCatalogWindow } from "../catalogPropagation";
import { elementEpoch, propagatedPosition } from "../propagation";

const satellite = { ...mockSatellites[0], noradId: 5,
  tleLine1: "1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753",
  tleLine2: "2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667" };

describe("catalog propagation worker geometry", () => {
  it("matches selected-object propagation in metres at both timestamps", () => {
    const time = elementEpoch(satellite)!.getTime();
    const result = propagateCatalogWindow([satellite], time, 7);
    const positions = Array.from(result.positions);
    expect(result.generation).toBe(7);
    expect(result.valid).toBe(1);
    for (const [sample, at] of [result.startMs, result.endMs].entries()) {
      const p = Cartesian3.fromArray(positions, sample * 3);
      expect(Cartesian3.distance(p, propagatedPosition(satellite, new Date(at))!)).toBeLessThan(0.001);
    }
    const midpoint = Cartesian3.midpoint(Cartesian3.fromArray(positions), Cartesian3.fromArray(positions, 3), new Cartesian3());
    expect(Cartesian3.distance(midpoint, propagatedPosition(satellite, new Date(time + 1000))!)).toBeLessThan(10);
  });
  it("preserves slots and withholds missing, decayed and expired elements", () => {
    const time = elementEpoch(satellite)!.getTime();
    const result = propagateCatalogWindow([mockSatellites[0], satellite, { ...satellite, decayDate: "2000-06-27" }], time);
    expect(result.total).toBe(3);
    expect(result.valid).toBe(1);
    expect([...result.positions.slice(0, 6), ...result.positions.slice(12)].every(Number.isNaN)).toBe(true);
    expect([...result.positions.slice(6, 12)].every(Number.isFinite)).toBe(true);
    expect(propagateCatalogWindow([satellite], time + 15 * 86400000).valid).toBe(0);
  });
});
