import { describe, expect, it } from "vitest";
import { alertColors, noaaScaleColors } from "../severityPalette";

describe("noaaScaleColors", () => {
  it("exposes one colour per NOAA scale tier", () => {
    expect(Object.keys(noaaScaleColors)).toEqual([
      "quiet",
      "minor",
      "moderate",
      "strong",
      "severe",
      "extreme"
    ]);
  });

  it("uses valid six-digit CSS hex values", () => {
    for (const value of Object.values(noaaScaleColors)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("escalates from quiet green to extreme red", () => {
    expect(noaaScaleColors.quiet).toBe("#7dff6a");
    expect(noaaScaleColors.extreme).toBe("#ff0000");
  });
});

describe("alertColors", () => {
  it("exposes the four Kp alert tiers", () => {
    expect(Object.keys(alertColors)).toEqual(["calm", "caution", "elevated", "severe"]);
  });

  it("uses valid six-digit CSS hex values", () => {
    for (const value of Object.values(alertColors)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("shares its quiet tier with the NOAA scale palette", () => {
    expect(alertColors.calm).toBe(noaaScaleColors.quiet);
  });
});
