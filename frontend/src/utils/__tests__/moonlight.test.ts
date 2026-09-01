import { describe, expect, it } from "vitest";
import {
  SYNODIC_MONTH_DAYS,
  moonAgeDays,
  moonPhaseFraction
} from "../moonlight";

/** A reference new Moon (2024-01-11T11:57Z) and full Moon (2024-01-25T17:54Z). */
const NEW_MOON = new Date("2024-01-11T11:57:00Z");
const FULL_MOON = new Date("2024-01-25T17:54:00Z");

describe("moonAgeDays", () => {
  it("reads near zero at a new Moon", () => {
    expect(moonAgeDays(NEW_MOON)).toBeLessThan(0.5);
  });

  it("reads roughly half a synodic month at a full Moon", () => {
    const age = moonAgeDays(FULL_MOON);
    expect(age).toBeGreaterThan(SYNODIC_MONTH_DAYS / 2 - 0.5);
    expect(age).toBeLessThan(SYNODIC_MONTH_DAYS / 2 + 0.5);
  });

  it("stays within the synodic month for any date", () => {
    const age = moonAgeDays(new Date("2030-07-04T00:00:00Z"));
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(SYNODIC_MONTH_DAYS);
  });

  it("returns NaN for an invalid date", () => {
    expect(moonAgeDays(new Date("not a date"))).toBeNaN();
  });
});

describe("moonPhaseFraction", () => {
  it("is near zero at a new Moon", () => {
    expect(moonPhaseFraction(NEW_MOON)).toBeLessThan(0.02);
  });

  it("is near one half at a full Moon", () => {
    expect(moonPhaseFraction(FULL_MOON)).toBeCloseTo(0.5, 1);
  });

  it("returns NaN for an invalid date", () => {
    expect(moonPhaseFraction(new Date("not a date"))).toBeNaN();
  });
});
