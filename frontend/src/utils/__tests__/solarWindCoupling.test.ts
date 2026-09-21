import { describe, expect, it } from "vitest";
import type { SpaceWeather } from "../../types/space";
import {
  COUPLING_LEVEL_LABELS,
  MERGING_FIELD_COEFFICIENT,
  RING_CURRENT_INJECTION_THRESHOLD_MV_M,
  couplingLevel,
  couplingLevelColor,
  dawnDuskElectricField,
  geoeffectiveElectricField,
  solarWindCouplingProfile
} from "../solarWindCoupling";

const makeWeather = (overrides: Partial<SpaceWeather> = {}): SpaceWeather => ({
  kpIndex: 3,
  solarWindSpeed: 400,
  solarWindDensity: 5,
  bzComponent: -2,
  xrayFlux: "B1.0",
  stormLevel: "none",
  auroraKp: 3,
  lastUpdated: new Date("2026-01-01T00:00:00Z"),
  ...overrides
});

describe("dawnDuskElectricField", () => {
  it("follows E = k * V * B for a southward field", () => {
    const expected = MERGING_FIELD_COEFFICIENT * 450 * 12.4;
    expect(dawnDuskElectricField(450, -12.4)).toBeCloseTo(expected, 9);
  });

  it("uses the field magnitude, so sign does not change the result", () => {
    expect(dawnDuskElectricField(400, -6)).toBeCloseTo(dawnDuskElectricField(400, 6), 12);
  });

  it("scales linearly with the bulk speed", () => {
    const slow = dawnDuskElectricField(400, -5);
    const fast = dawnDuskElectricField(800, -5);
    expect(fast).toBeCloseTo(slow * 2, 12);
  });

  it("is zero when the wind is at rest or the field vanishes", () => {
    expect(dawnDuskElectricField(0, -10)).toBe(0);
    expect(dawnDuskElectricField(500, 0)).toBe(0);
  });

  it("clamps a negative speed to zero rather than flipping the sign", () => {
    expect(dawnDuskElectricField(-400, -5)).toBe(0);
  });

  it("returns zero for non-finite inputs", () => {
    expect(dawnDuskElectricField(Number.NaN, -5)).toBe(0);
    expect(dawnDuskElectricField(400, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("geoeffectiveElectricField", () => {
  it("equals the full field when Bz points southward", () => {
    expect(geoeffectiveElectricField(450, -12.4)).toBeCloseTo(
      dawnDuskElectricField(450, -12.4),
      12
    );
  });

  it("is zero for a northward field, which does not reconnect", () => {
    expect(geoeffectiveElectricField(450, 12.4)).toBe(0);
  });

  it("is zero when Bz is exactly zero", () => {
    expect(geoeffectiveElectricField(450, 0)).toBe(0);
  });

  it("returns zero for a non-finite Bz", () => {
    expect(geoeffectiveElectricField(450, Number.NaN)).toBe(0);
  });
});

describe("couplingLevel", () => {
  it("treats a field below the injection threshold as quiet", () => {
    expect(couplingLevel(RING_CURRENT_INJECTION_THRESHOLD_MV_M - 0.01)).toBe("quiet");
    expect(couplingLevel(0)).toBe("quiet");
  });

  it("becomes elevated at the injection threshold", () => {
    expect(couplingLevel(RING_CURRENT_INJECTION_THRESHOLD_MV_M)).toBe("elevated");
    expect(couplingLevel(2)).toBe("elevated");
  });

  it("is high through the 3-8 mV/m band", () => {
    expect(couplingLevel(3)).toBe("high");
    expect(couplingLevel(7.99)).toBe("high");
  });

  it("is extreme at 8 mV/m and above", () => {
    expect(couplingLevel(8)).toBe("extreme");
    expect(couplingLevel(20)).toBe("extreme");
  });

  it("falls back to quiet for negative or non-finite fields", () => {
    expect(couplingLevel(-5)).toBe("quiet");
    expect(couplingLevel(Number.NaN)).toBe("quiet");
  });
});

describe("couplingLevelColor", () => {
  it("returns a distinct hex colour for each band", () => {
    const colors = [
      couplingLevelColor("quiet"),
      couplingLevelColor("elevated"),
      couplingLevelColor("high"),
      couplingLevelColor("extreme")
    ];
    colors.forEach((color) => expect(color).toMatch(/^#[0-9a-f]{6}$/i));
    expect(new Set(colors).size).toBe(4);
  });

  it("falls back to the quiet colour for an unknown band", () => {
    expect(couplingLevelColor("None")).toBe(couplingLevelColor("quiet"));
  });
});

describe("COUPLING_LEVEL_LABELS", () => {
  it("labels every band with distinct, non-empty text", () => {
    const labels = Object.values(COUPLING_LEVEL_LABELS);
    labels.forEach((label) => expect(label.length).toBeGreaterThan(0));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("has a label for the band each field maps to", () => {
    expect(COUPLING_LEVEL_LABELS[couplingLevel(0)]).toBe("Weak coupling");
    expect(COUPLING_LEVEL_LABELS[couplingLevel(10)]).toBe("Extreme coupling");
  });
});
