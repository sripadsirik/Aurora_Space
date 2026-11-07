import { describe, expect, it } from "vitest";
import { Cartesian3 } from "cesium";
import { AircraftMotion } from "./smoothMotion";
import type { Aircraft } from "./data";
const aircraft: Aircraft = {
  id: "test",
  name: "TEST",
  registration: "",
  model: "B738",
  lat: 30,
  lon: -80,
  altitudeM: 10000,
  altitudeKind: "geometric",
  speed: 400,
  heading: 359,
  military: false,
  observedAt: 100000,
};
describe("aircraft display motion", () => {
  it("moves at frame cadence instead of 100ms position steps", () => {
    const m = new AircraftMotion(aircraft);
    const p = m.position(101000),
      q = m.position(101016);
    expect(Cartesian3.distance(p, q)).toBeGreaterThan(2);
    expect(Cartesian3.distance(p, q)).toBeLessThan(5);
  });
  it("blends a correction without jumping and turns through north by the short angle", () => {
    const m = new AircraftMotion(aircraft),
      before = m.position(110000);
    m.update(
      { ...aircraft, lat: 30.03, heading: 1, observedAt: 110000 },
      110000,
    );
    expect(Cartesian3.distance(before, m.position(110000))).toBeLessThan(
      0.0001,
    );
    expect((m.heading(111000) * 180) / Math.PI).toBeCloseTo(360);
    const target = Cartesian3.fromDegrees(-80, 30.03, 10000);
    expect(Cartesian3.distance(m.position(112000), target)).toBeGreaterThan(
      300,
    );
    expect((m.heading(112000) * 180) / Math.PI).toBeCloseTo(361);
  });
  it("keeps stale motion bounded and ignores out-of-order observations", () => {
    const m = new AircraftMotion(aircraft);
    expect(m.position(140000)).toEqual(m.position(180000));
    const before = m.position(110000);
    m.update({ ...aircraft, lat: 0, observedAt: 99000 }, 110000);
    expect(m.position(110000)).toEqual(before);
  });
  it("does not animate a teleport across a missing track", () => {
    const m = new AircraftMotion(aircraft);
    m.update({ ...aircraft, lat: -30, observedAt: 110000, speed: 0 }, 110000);
    expect(
      Cartesian3.distance(
        m.position(110000),
        Cartesian3.fromDegrees(-80, -30, 10000),
      ),
    ).toBeLessThan(0.001);
  });
});
