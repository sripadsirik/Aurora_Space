import { describe, expect, it } from "vitest";

import { summarizeNoaaScales } from "../noaaScaleSummary";

describe("summarizeNoaaScales resolution", () => {
  it("resolves each scale from its own driver", () => {
    const summary = summarizeNoaaScales({ kpIndex: 6, xrayFlux: "X1", protonFlux: 1000 });
    expect(summary.geomagnetic.level).toBe("G2");
    expect(summary.radioBlackout.level).toBe("R3");
    expect(summary.solarRadiation.level).toBe("S3");
  });

  it("tags each entry with its scale kind and a severity code", () => {
    const summary = summarizeNoaaScales({ kpIndex: 5, xrayFlux: "M5", protonFlux: 10 });
    expect(summary.geomagnetic.kind).toBe("G");
    expect(summary.solarRadiation.kind).toBe("S");
    expect(summary.radioBlackout.kind).toBe("R");
    expect(summary.geomagnetic.code).toBe(1);
    expect(summary.radioBlackout.code).toBe(2);
    expect(summary.solarRadiation.code).toBe(1);
  });

  it("treats a missing proton flux as quiet (S0)", () => {
    const summary = summarizeNoaaScales({ kpIndex: 3, xrayFlux: "C2.4" });
    expect(summary.solarRadiation.level).toBe("S0");
    expect(summary.solarRadiation.code).toBe(0);
  });

  it("carries a colour for each resolved level", () => {
    const summary = summarizeNoaaScales({ kpIndex: 9, xrayFlux: "X20", protonFlux: 1e5 });
    expect(summary.geomagnetic.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(summary.solarRadiation.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(summary.radioBlackout.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("summarizeNoaaScales peak selection", () => {
  it("picks the single most severe scale by code", () => {
    const summary = summarizeNoaaScales({ kpIndex: 3, xrayFlux: "X10", protonFlux: 5 });
    expect(summary.peak.kind).toBe("R");
    expect(summary.peak.level).toBe("R4");
  });

  it("breaks ties in G > S > R order", () => {
    // Kp 8 -> G4 (code 4), proton 1e4 -> S4 (code 4), X-ray X10 -> R4 (code 4).
    const summary = summarizeNoaaScales({ kpIndex: 8, xrayFlux: "X10", protonFlux: 1e4 });
    expect(summary.peak.code).toBe(4);
    expect(summary.peak.kind).toBe("G");
  });

  it("prefers S over R when they tie above G", () => {
    // Kp 3 -> G0, proton 1000 -> S3, X-ray X1 -> R3: S wins the S-over-R tie-break.
    const summary = summarizeNoaaScales({ kpIndex: 3, xrayFlux: "X1", protonFlux: 1000 });
    expect(summary.peak.code).toBe(3);
    expect(summary.peak.kind).toBe("S");
  });

  it("returns a quiet geomagnetic peak when every scale is quiet", () => {
    const summary = summarizeNoaaScales({ kpIndex: 2, xrayFlux: "B1", protonFlux: 0 });
    expect(summary.peak.kind).toBe("G");
    expect(summary.peak.level).toBe("G0");
    expect(summary.peak.code).toBe(0);
  });
});
