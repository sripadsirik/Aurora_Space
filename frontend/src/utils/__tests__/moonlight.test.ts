import { describe, expect, it } from "vitest";
import {
  SYNODIC_MONTH_DAYS,
  MOONLIGHT_BRIGHT_MIN_ILLUMINATION,
  MOONLIGHT_DARK_MAX_ILLUMINATION,
  MOONLIGHT_LEVEL_LABELS,
  MOON_PHASE_NAMES,
  classifyMoonlight,
  moonAgeDays,
  moonIlluminatedFraction,
  moonPhaseFraction,
  moonPhaseName
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

describe("moonIlluminatedFraction", () => {
  it("is near zero at a new Moon", () => {
    expect(moonIlluminatedFraction(NEW_MOON)).toBeLessThan(0.02);
  });

  it("is near one at a full Moon", () => {
    expect(moonIlluminatedFraction(FULL_MOON)).toBeGreaterThan(0.98);
  });

  it("is roughly half lit at first quarter", () => {
    // 2024-01-18T03:53Z is the January 2024 first quarter.
    const firstQuarter = new Date("2024-01-18T03:53:00Z");
    expect(moonIlluminatedFraction(firstQuarter)).toBeCloseTo(0.5, 1);
  });

  it("stays within [0, 1] for any date", () => {
    const fraction = moonIlluminatedFraction(new Date("2027-03-15T09:00:00Z"));
    expect(fraction).toBeGreaterThanOrEqual(0);
    expect(fraction).toBeLessThanOrEqual(1);
  });

  it("returns NaN for an invalid date", () => {
    expect(moonIlluminatedFraction(new Date("not a date"))).toBeNaN();
  });
});

describe("moonPhaseName", () => {
  it("names a new Moon", () => {
    expect(moonPhaseName(NEW_MOON)).toBe("New Moon");
  });

  it("names a full Moon", () => {
    expect(moonPhaseName(FULL_MOON)).toBe("Full Moon");
  });

  it("names the first quarter", () => {
    expect(moonPhaseName(new Date("2024-01-18T03:53:00Z"))).toBe("First Quarter");
  });

  it("names the last quarter", () => {
    expect(moonPhaseName(new Date("2024-01-04T03:30:00Z"))).toBe("Last Quarter");
  });

  it("only ever returns one of the eight named phases", () => {
    const name = moonPhaseName(new Date("2025-09-01T00:00:00Z"));
    expect(MOON_PHASE_NAMES).toContain(name);
  });

  it("returns null for an invalid date", () => {
    expect(moonPhaseName(new Date("not a date"))).toBeNull();
  });
});

describe("classifyMoonlight", () => {
  it("treats a dim Moon as dark skies", () => {
    expect(classifyMoonlight(0.1)).toBe("dark");
  });

  it("treats a near-full Moon as bright", () => {
    expect(classifyMoonlight(0.9)).toBe("bright");
  });

  it("treats a partly lit Moon as moderate", () => {
    expect(classifyMoonlight(0.45)).toBe("moderate");
  });

  it("includes the dark boundary in the dark tier", () => {
    expect(classifyMoonlight(MOONLIGHT_DARK_MAX_ILLUMINATION)).toBe("dark");
  });

  it("includes the bright boundary in the bright tier", () => {
    expect(classifyMoonlight(MOONLIGHT_BRIGHT_MIN_ILLUMINATION)).toBe("bright");
  });

  it("falls back to dark for a non-finite fraction", () => {
    expect(classifyMoonlight(Number.NaN)).toBe("dark");
  });

  it("has a label for every level", () => {
    expect(MOONLIGHT_LEVEL_LABELS.dark).toBeTruthy();
    expect(MOONLIGHT_LEVEL_LABELS.moderate).toBeTruthy();
    expect(MOONLIGHT_LEVEL_LABELS.bright).toBeTruthy();
  });
});
