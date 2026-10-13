import { describe, expect, it } from "vitest";
import { Cartesian3 } from "cesium";
import { gstime } from "satellite.js";
import { elementEpoch, propagatedPosition, predictedOrbit } from "../propagation";
import { mockSatellites } from "../../data/mock/satellites";

// Vallado SGP4 verification case 00005 (AIAA 2006-6753).
const satellite = { ...mockSatellites[0], noradId: 5,
  tleLine1: "1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753",
  tleLine2: "2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667" };

describe("real TLE propagation", () => {
  it("matches the published epoch state vector to within 30 metres after Earth rotation", () => {
    const epoch = elementEpoch(satellite)!;
    const position = propagatedPosition(satellite, epoch)!;
    const theta = gstime(epoch);
    const expected = new Cartesian3(
      (7022.46529266 * Math.cos(theta) - 1400.08296755 * Math.sin(theta)) * 1000,
      (-7022.46529266 * Math.sin(theta) - 1400.08296755 * Math.cos(theta)) * 1000,
      0.03995155 * 1000);
    expect(Cartesian3.distance(position, expected)).toBeLessThan(30);
  });
  it("moves with time and leaves an open Earth-fixed trajectory", () => {
    const epoch = elementEpoch(satellite)!;
    const p1 = propagatedPosition(satellite, epoch)!;
    const p2 = propagatedPosition(satellite, new Date(epoch.getTime()+60000))!;
    expect(Cartesian3.distance(p1,p2)).toBeGreaterThan(100000);
    const path = predictedOrbit(satellite,epoch);
    expect(path).toHaveLength(181);
    expect(Cartesian3.distance(path[0],path.at(-1)!)).toBeGreaterThan(1000000);
  });
  it("never invents an orbit for missing, malformed or stale elements", () => {
    expect(predictedOrbit(mockSatellites[0])).toEqual([]);
    expect(propagatedPosition({...satellite,tleLine1:'invalid'},elementEpoch(satellite)!)).toBeNull();
    expect(propagatedPosition(satellite,new Date('2026-10-11'))).toBeNull();
  });
});
