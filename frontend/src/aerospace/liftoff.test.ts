import { expect, it } from "vitest";
import { ascentSample, ASCENT_DURATION } from "./liftoff";
it("starts at the pad and bounds the illustrative trajectory when scrubbing", () => {
  expect(ascentSample(0)).toEqual({ altitude: 0, downrange: 0, tilt: 0 });
  expect(ascentSample(-10)).toEqual(ascentSample(0));
  expect(ascentSample(999)).toEqual(ascentSample(ASCENT_DURATION));
  let previous = 0;
  for (let t = 0; t <= ASCENT_DURATION; t++) {
    const p = ascentSample(t);
    expect(p.altitude).toBeGreaterThanOrEqual(previous);
    expect(Number.isFinite(p.downrange)).toBe(true);
    previous = p.altitude;
  }
});
