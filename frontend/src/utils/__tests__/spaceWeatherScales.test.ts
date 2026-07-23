import { describe, expect, it } from "vitest";
import {
  geomagneticStormScale,
  gScaleColor,
  gScaleInfo,
  kpToGScale,
  kpToGScaleInfo
} from "../spaceWeatherScales";

describe("kpToGScale", () => {
  it("treats sub-storm Kp as quiet (G0)", () => {
    expect(kpToGScale(0)).toBe("G0");
    expect(kpToGScale(4.9)).toBe("G0");
  });

  it("maps each whole Kp step to the matching G-level", () => {
    expect(kpToGScale(5)).toBe("G1");
    expect(kpToGScale(6)).toBe("G2");
    expect(kpToGScale(7)).toBe("G3");
    expect(kpToGScale(8)).toBe("G4");
    expect(kpToGScale(9)).toBe("G5");
  });

  it("treats the thresholds as inclusive lower bounds", () => {
    expect(kpToGScale(6.9)).toBe("G2");
    expect(kpToGScale(7)).toBe("G3");
  });

  it("clamps values above Kp 9 to G5", () => {
    expect(kpToGScale(12)).toBe("G5");
  });
});

describe("gScaleColor", () => {
  it("returns a distinct colour for each active storm level", () => {
    const colors = new Set(
      geomagneticStormScale.map((entry) => gScaleColor(entry.level))
    );
    expect(colors.size).toBe(geomagneticStormScale.length);
  });

  it("escalates from quiet green to extreme red", () => {
    expect(gScaleColor("G0")).toBe("#7dff6a");
    expect(gScaleColor("G5")).toBe("#ff0000");
  });

  it("falls back to quiet green for unknown levels", () => {
    expect(gScaleColor("None")).toBe("#7dff6a");
    expect(gScaleColor("")).toBe("#7dff6a");
  });
});

describe("gScaleInfo", () => {
  it("returns matching metadata for an active level", () => {
    const info = gScaleInfo("G3");
    expect(info.code).toBe(3);
    expect(info.label).toBe("Strong");
    expect(info.impact.length).toBeGreaterThan(0);
  });

  it("defaults to quiet conditions for unknown levels", () => {
    const info = gScaleInfo("None");
    expect(info.level).toBe("G0");
    expect(info.code).toBe(0);
  });
});

describe("geomagneticStormScale", () => {
  it("lists the five active levels in ascending severity", () => {
    expect(geomagneticStormScale.map((entry) => entry.level)).toEqual([
      "G1",
      "G2",
      "G3",
      "G4",
      "G5"
    ]);
    const codes = geomagneticStormScale.map((entry) => entry.code);
    expect(codes).toEqual([...codes].sort((a, b) => a - b));
  });
});

describe("kpToGScaleInfo", () => {
  it("resolves a Kp index straight to its metadata", () => {
    expect(kpToGScaleInfo(8.2).level).toBe("G4");
    expect(kpToGScaleInfo(2).code).toBe(0);
  });
});
