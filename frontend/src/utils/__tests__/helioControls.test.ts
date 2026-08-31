import { describe, expect, it } from "vitest";
import {
  burstIntensityToPercent,
  helioPlaybackLabel,
  percentToBurstIntensity
} from "../helioControls";

describe("helioPlaybackLabel", () => {
  it("shows the resume speed while paused", () => {
    expect(helioPlaybackLabel(0, 50)).toBe("PAUSED @ x50");
  });

  it("shows the live rate while running", () => {
    expect(helioPlaybackLabel(200, 50)).toBe("PLAY x200");
  });
});

describe("burst-intensity conversions", () => {
  it("maps the nominal fraction to 100 percent", () => {
    expect(burstIntensityToPercent(1)).toBe(100);
  });

  it("rounds the slider percentage to a whole number", () => {
    expect(burstIntensityToPercent(1.234)).toBe(123);
  });

  it("maps a slider percentage back to a fraction", () => {
    expect(percentToBurstIntensity(250)).toBe(2.5);
  });

  it("round-trips a slider percentage unchanged", () => {
    expect(burstIntensityToPercent(percentToBurstIntensity(175))).toBe(175);
  });
});
