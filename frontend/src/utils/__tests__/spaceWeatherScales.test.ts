import { describe, expect, it } from "vitest";
import {
  geomagneticStormScale,
  gScaleColor,
  gScaleInfo,
  kpToGScale,
  kpToGScaleInfo,
  parseXrayFlux,
  protonFluxToSScale,
  protonFluxToSScaleInfo,
  radioBlackoutScale,
  solarRadiationStormScale,
  sScaleColor,
  sScaleInfo,
  rScaleColor,
  rScaleInfo,
  xrayClassToRScale,
  xrayClassToRScaleInfo,
  xrayFluxToRScale,
  xrayFluxToRScaleInfo
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

describe("parseXrayFlux", () => {
  it("converts a class string to peak flux in W/m^2", () => {
    expect(parseXrayFlux("C2.4")).toBeCloseTo(2.4e-6, 12);
    expect(parseXrayFlux("M5")).toBeCloseTo(5e-5, 12);
    expect(parseXrayFlux("X10")).toBeCloseTo(1e-3, 12);
  });

  it("treats a bare class letter as magnitude 1", () => {
    expect(parseXrayFlux("X")).toBeCloseTo(1e-4, 12);
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(parseXrayFlux("  m2  ")).toBeCloseTo(2e-5, 12);
  });

  it("returns null for strings that are not a valid class", () => {
    expect(parseXrayFlux("Z1")).toBeNull();
    expect(parseXrayFlux("")).toBeNull();
    expect(parseXrayFlux("none")).toBeNull();
  });
});

describe("xrayFluxToRScale", () => {
  it("maps NOAA flux thresholds to radio blackout levels", () => {
    expect(xrayFluxToRScale(1e-5)).toBe("R1");
    expect(xrayFluxToRScale(5e-5)).toBe("R2");
    expect(xrayFluxToRScale(1e-4)).toBe("R3");
    expect(xrayFluxToRScale(1e-3)).toBe("R4");
    expect(xrayFluxToRScale(2e-3)).toBe("R5");
  });

  it("treats sub-blackout flux as R0", () => {
    expect(xrayFluxToRScale(9e-6)).toBe("R0");
    expect(xrayFluxToRScale(0)).toBe("R0");
  });

  it("steps down one level just below each threshold", () => {
    expect(xrayFluxToRScale(4.9e-5)).toBe("R1");
    expect(xrayFluxToRScale(9.9e-5)).toBe("R2");
    expect(xrayFluxToRScale(9.9e-4)).toBe("R3");
    expect(xrayFluxToRScale(1.9e-3)).toBe("R4");
  });
});

describe("xrayClassToRScale", () => {
  it("resolves a class string straight to a radio blackout level", () => {
    expect(xrayClassToRScale("C2.4")).toBe("R0");
    expect(xrayClassToRScale("M1")).toBe("R1");
    expect(xrayClassToRScale("M5")).toBe("R2");
    expect(xrayClassToRScale("M9.9")).toBe("R2");
    expect(xrayClassToRScale("X1")).toBe("R3");
    expect(xrayClassToRScale("X20")).toBe("R5");
  });

  it("falls back to R0 for unparseable input", () => {
    expect(xrayClassToRScale("n/a")).toBe("R0");
  });
});

describe("rScaleColor", () => {
  it("returns a distinct colour for each active blackout level", () => {
    const colors = new Set(radioBlackoutScale.map((entry) => rScaleColor(entry.level)));
    expect(colors.size).toBe(radioBlackoutScale.length);
  });

  it("escalates from quiet green to extreme red", () => {
    expect(rScaleColor("R0")).toBe("#7dff6a");
    expect(rScaleColor("R5")).toBe("#ff0000");
  });

  it("falls back to quiet green for unknown levels", () => {
    expect(rScaleColor("None")).toBe("#7dff6a");
    expect(rScaleColor("")).toBe("#7dff6a");
  });
});

describe("radioBlackoutScale", () => {
  it("lists the five active levels in ascending severity", () => {
    expect(radioBlackoutScale.map((entry) => entry.level)).toEqual([
      "R1",
      "R2",
      "R3",
      "R4",
      "R5"
    ]);
    const codes = radioBlackoutScale.map((entry) => entry.code);
    expect(codes).toEqual([...codes].sort((a, b) => a - b));
  });
});

describe("rScaleInfo", () => {
  it("returns matching metadata for an active level", () => {
    const info = rScaleInfo("R3");
    expect(info.code).toBe(3);
    expect(info.label).toBe("Strong");
    expect(info.impact.length).toBeGreaterThan(0);
  });

  it("defaults to quiet conditions for unknown levels", () => {
    const info = rScaleInfo("None");
    expect(info.level).toBe("R0");
    expect(info.code).toBe(0);
  });
});

describe("xrayFluxToRScaleInfo", () => {
  it("resolves a peak flux straight to its metadata", () => {
    expect(xrayFluxToRScaleInfo(1e-4).level).toBe("R3");
    expect(xrayFluxToRScaleInfo(9e-6).code).toBe(0);
  });
});

describe("xrayClassToRScaleInfo", () => {
  it("resolves a class string straight to its metadata", () => {
    const info = xrayClassToRScaleInfo("X1");
    expect(info.level).toBe("R3");
    expect(info.label).toBe("Strong");
  });

  it("falls back to quiet conditions for unparseable input", () => {
    expect(xrayClassToRScaleInfo("n/a").level).toBe("R0");
  });
});

describe("protonFluxToSScale", () => {
  it("maps NOAA proton-flux thresholds to radiation storm levels", () => {
    expect(protonFluxToSScale(1e1)).toBe("S1");
    expect(protonFluxToSScale(1e2)).toBe("S2");
    expect(protonFluxToSScale(1e3)).toBe("S3");
    expect(protonFluxToSScale(1e4)).toBe("S4");
    expect(protonFluxToSScale(1e5)).toBe("S5");
  });

  it("treats sub-storm flux as quiet (S0)", () => {
    expect(protonFluxToSScale(9.9)).toBe("S0");
    expect(protonFluxToSScale(0)).toBe("S0");
  });

  it("steps down one level just below each threshold", () => {
    expect(protonFluxToSScale(99)).toBe("S1");
    expect(protonFluxToSScale(999)).toBe("S2");
    expect(protonFluxToSScale(9999)).toBe("S3");
    expect(protonFluxToSScale(99999)).toBe("S4");
  });

  it("clamps flux above the S5 threshold to S5", () => {
    expect(protonFluxToSScale(5e6)).toBe("S5");
  });
});

describe("sScaleColor", () => {
  it("returns a distinct colour for each active storm level", () => {
    const colors = new Set(
      solarRadiationStormScale.map((entry) => sScaleColor(entry.level))
    );
    expect(colors.size).toBe(solarRadiationStormScale.length);
  });

  it("escalates from quiet green to extreme red", () => {
    expect(sScaleColor("S0")).toBe("#7dff6a");
    expect(sScaleColor("S5")).toBe("#ff0000");
  });

  it("falls back to quiet green for unknown levels", () => {
    expect(sScaleColor("None")).toBe("#7dff6a");
    expect(sScaleColor("")).toBe("#7dff6a");
  });
});

describe("solarRadiationStormScale", () => {
  it("lists the five active levels in ascending severity", () => {
    expect(solarRadiationStormScale.map((entry) => entry.level)).toEqual([
      "S1",
      "S2",
      "S3",
      "S4",
      "S5"
    ]);
    const codes = solarRadiationStormScale.map((entry) => entry.code);
    expect(codes).toEqual([...codes].sort((a, b) => a - b));
  });
});

describe("sScaleInfo", () => {
  it("returns matching metadata for an active level", () => {
    const info = sScaleInfo("S3");
    expect(info.code).toBe(3);
    expect(info.label).toBe("Strong");
    expect(info.impact.length).toBeGreaterThan(0);
  });

  it("defaults to quiet conditions for unknown levels", () => {
    const info = sScaleInfo("None");
    expect(info.level).toBe("S0");
    expect(info.code).toBe(0);
  });
});

describe("protonFluxToSScaleInfo", () => {
  it("resolves a proton flux straight to its metadata", () => {
    expect(protonFluxToSScaleInfo(1e3).level).toBe("S3");
    expect(protonFluxToSScaleInfo(5).code).toBe(0);
  });
});

describe("NOAA scale colour consistency", () => {
  it("shares one green-to-red escalation palette across G, R, and S scales", () => {
    for (let code = 0; code <= 5; code += 1) {
      expect(sScaleColor(`S${code}`)).toBe(gScaleColor(`G${code}`));
      expect(sScaleColor(`S${code}`)).toBe(rScaleColor(`R${code}`));
    }
  });
});
