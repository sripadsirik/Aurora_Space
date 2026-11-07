import { expect, it } from "vitest";
import { parseWorldwideAircraft } from "./data";

const observation = ["abc123", "TEST123 ", "United States", 997, 999, -87.6, 41.9, 9000, false, 200, 90, 0, null, 9200];
it("uses source observation times and converts OpenSky speed to knots without changing metre altitudes", () => {
  const [plane] = parseWorldwideAircraft({ time: 1000, states: [observation] });
  expect(plane).toMatchObject({ name: "TEST123", observedAt: 997000, altitudeM: 9200, altitudeKind: "geometric", military: false });
  expect(plane.speed).toBeCloseTo(388.77, 1);
});
it("rejects missing coordinates, stale or future positions and aircraft on the ground", () => {
  const change = (index: number, value: unknown) => observation.map((v, i) => i === index ? value : v);
  expect(parseWorldwideAircraft({ time: 1000, states: [null, change(5, null), change(6, 91), change(3, 900), change(3, 1010), change(8, true), observation] })).toHaveLength(1);
  expect(parseWorldwideAircraft({ time: 1000, states: null })).toEqual([]);
  expect(() => parseWorldwideAircraft({ states: [] })).toThrow();
});
it("does not truncate the worldwide catalog to the former regional limit", () => {
  const states = Array.from({ length: 6000 }, (_, i) => [i.toString(16), ...observation.slice(1)]);
  expect(parseWorldwideAircraft({ time: 1000, states })).toHaveLength(6000);
});
