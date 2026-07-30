import { Color } from "cesium";
import { describe, expect, it } from "vitest";
import { conjunctionFleetSeverityColor, getKpColor, getSolarWindColor, riskColorMap } from "../colors";

describe("getKpColor", () => {
  it("returns the quiet colour below Kp 3", () => {
    expect(getKpColor(0)).toBe("#7dff6a");
    expect(getKpColor(2.9)).toBe("#7dff6a");
  });

  it("returns the unsettled colour in the Kp 3-5 band", () => {
    expect(getKpColor(3)).toBe("#ffcc00");
    expect(getKpColor(4.9)).toBe("#ffcc00");
  });

  it("returns the storm colour in the Kp 5-7 band", () => {
    expect(getKpColor(5)).toBe("#ff8b38");
    expect(getKpColor(6.9)).toBe("#ff8b38");
  });

  it("returns the severe colour at Kp 7 and above", () => {
    expect(getKpColor(7)).toBe("#ff2a2a");
    expect(getKpColor(9)).toBe("#ff2a2a");
  });
});

describe("getSolarWindColor", () => {
  it("uses the calm colour below 400 km/s", () => {
    expect(getSolarWindColor(350).equals(Color.fromCssColorString("#fff6b3"))).toBe(true);
  });

  it("uses the elevated colour in the 400-600 km/s band inclusive", () => {
    expect(getSolarWindColor(400).equals(Color.fromCssColorString("#ff8d42"))).toBe(true);
    expect(getSolarWindColor(600).equals(Color.fromCssColorString("#ff8d42"))).toBe(true);
  });

  it("uses the high-speed colour above 600 km/s", () => {
    expect(getSolarWindColor(700).equals(Color.fromCssColorString("#ff2a2a"))).toBe(true);
  });
});

describe("conjunctionFleetSeverityColor", () => {
  it("uses severe red for a critical fleet", () => {
    expect(conjunctionFleetSeverityColor("critical")).toBe("#ff2a2a");
  });

  it("uses amber for a warning fleet", () => {
    expect(conjunctionFleetSeverityColor("warning")).toBe("#ff8b38");
  });

  it("uses quiet yellow for the elevated and clear tiers", () => {
    expect(conjunctionFleetSeverityColor("elevated")).toBe("#ffcc00");
    expect(conjunctionFleetSeverityColor("clear")).toBe("#ffcc00");
  });
});

describe("riskColorMap", () => {
  it("defines a distinct colour for every risk level", () => {
    const levels = ["nominal", "watch", "warning", "critical"] as const;
    for (const level of levels) {
      expect(riskColorMap[level]).toBeInstanceOf(Color);
    }
    const serialized = levels.map((level) => riskColorMap[level].toCssHexString());
    expect(new Set(serialized).size).toBe(levels.length);
  });
});
