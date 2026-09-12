import { describe, expect, it } from "vitest";
import { noaaScaleColors } from "../severityPalette";

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
