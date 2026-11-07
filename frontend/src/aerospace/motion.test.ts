import { expect, it } from "vitest";
import { estimatedPosition } from "./motion";
import { countdown, type Aircraft } from "./data";
const a: Aircraft = {
  id: "a",
  name: "a",
  registration: "",
  model: "",
  lat: 0,
  lon: 179.99,
  altitudeM: 10000,
  altitudeKind: "geometric",
  speed: 500,
  heading: 90,
  military: false,
  observedAt: 0,
};
it("bounds extrapolation, preserves observations and wraps the date line", () => {
  const p = estimatedPosition(a, 30000);
  expect(p.lon).toBeLessThan(-179);
  expect(Math.abs(p.lat)).toBeLessThan(0.001);
  expect(estimatedPosition(a, 90000)).toEqual(p);
  expect(a.lon).toBe(179.99);
  expect(estimatedPosition({ ...a, speed: null }, 10000)).toEqual({
    ...a,
    speed: null,
  });
});
it("uses provider flight and outcome status instead of inventing a countdown", () => {
  for (const status of ["Launch Successful", "Launch Failure", "In Flight"])
    expect(countdown("2026-01-01", Date.now(), status)).toBe(status);
});
