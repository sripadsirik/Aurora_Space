import { expect, it } from "vitest";
import { Cartesian3 } from "cesium";
import { parseRocketTelemetry, rocketPositionAt } from "./rocketTelemetry";
const now = Date.parse("2026-11-05T16:01:00Z");
const sample = (time: number, altitudeM: number) => ({
  vehicleId: "booster",
  observedAt: new Date(time).toISOString(),
  latitude: 28,
  longitude: -80,
  altitudeM,
  headingDeg: 90,
  phase: "ascent",
});
const feed = (positions: any[]) => ({
  missionId: "mission",
  source: "Test observation provider",
  positionType: "observed",
  positions,
});
it("requires a matching mission, absolute recent timestamps and observed coordinates", () => {
  expect(() => parseRocketTelemetry(feed([]), "other", now)).toThrow();
  expect(() =>
    parseRocketTelemetry(
      { ...feed([]), positionType: "simulated" },
      "mission",
      now,
    ),
  ).toThrow();
  const parsed = parseRocketTelemetry(
    feed([
      sample(now, 1000),
      sample(now - 120000, 500),
      { ...sample(now, 1000), latitude: 91 },
      { ...sample(now, 1000), observedAt: "T+20s" },
    ]),
    "mission",
    now,
  );
  expect(parsed.positions).toHaveLength(1);
  expect(parsed.positions[0]).toMatchObject({
    altitudeM: 1000,
    lat: 28,
    lon: -80,
    observedAt: now,
  });
});
it("renders ascent and descent between observed positions without extrapolating", () => {
  const positions = parseRocketTelemetry(
    feed([
      sample(now - 2000, 1000),
      sample(now, 2000),
      { ...sample(now + 2000, 500), phase: "descent" },
    ]),
    "mission",
    now,
  ).positions;
  const a = rocketPositionAt(positions, now)!,
    b = rocketPositionAt(positions, now + 2000)!;
  expect(
    Cartesian3.distance(a, Cartesian3.fromDegrees(-80, 28, 1500)),
  ).toBeLessThan(0.001);
  expect(
    Cartesian3.distance(b, Cartesian3.fromDegrees(-80, 28, 1250)),
  ).toBeLessThan(0.001);
  expect(rocketPositionAt(positions, now + 60000)).toEqual(
    Cartesian3.fromDegrees(-80, 28, 500),
  );
});
it("bounds the number of rendered vehicles", () => {
  const p = Array.from({ length: 100 }, (_, i) => ({
    ...sample(now, 100),
    vehicleId: "stage-" + i,
  }));
  expect(
    new Set(
      parseRocketTelemetry(feed(p), "mission", now).positions.map(
        (p) => p.vehicleId,
      ),
    ).size,
  ).toBe(16);
});
