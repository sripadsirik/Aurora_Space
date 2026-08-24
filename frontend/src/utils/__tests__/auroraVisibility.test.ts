import { describe, expect, it } from "vitest";
import {
  AURORA_BOUNDARY_LATITUDES_BY_KP,
  AURORA_HORIZON_ALLOWANCE_DEG,
  auroraBoundaryLatitude,
  auroraVisibilityMargin
} from "../auroraVisibility";

describe("AURORA_BOUNDARY_LATITUDES_BY_KP", () => {
  it("has one entry for every integer Kp level 0-9", () => {
    expect(AURORA_BOUNDARY_LATITUDES_BY_KP).toHaveLength(10);
  });

  it("descends monotonically as Kp climbs", () => {
    for (let kp = 1; kp < AURORA_BOUNDARY_LATITUDES_BY_KP.length; kp += 1) {
      expect(AURORA_BOUNDARY_LATITUDES_BY_KP[kp]).toBeLessThan(
        AURORA_BOUNDARY_LATITUDES_BY_KP[kp - 1]
      );
    }
  });

  it("stays within plausible high-latitude bounds", () => {
    for (const latitude of AURORA_BOUNDARY_LATITUDES_BY_KP) {
      expect(latitude).toBeGreaterThan(40);
      expect(latitude).toBeLessThan(70);
    }
  });
});

describe("auroraBoundaryLatitude", () => {
  it("returns the table value at each integer Kp level", () => {
    for (let kp = 0; kp <= 9; kp += 1) {
      expect(auroraBoundaryLatitude(kp)).toBe(AURORA_BOUNDARY_LATITUDES_BY_KP[kp]);
    }
  });

  it("linearly interpolates between integer levels", () => {
    // Halfway between Kp 3 (60.4) and Kp 4 (58.3).
    expect(auroraBoundaryLatitude(3.5)).toBeCloseTo((60.4 + 58.3) / 2, 10);
  });

  it("clamps readings below Kp 0 to the Kp 0 boundary", () => {
    expect(auroraBoundaryLatitude(-4)).toBe(AURORA_BOUNDARY_LATITUDES_BY_KP[0]);
  });

  it("clamps readings above Kp 9 to the Kp 9 boundary", () => {
    expect(auroraBoundaryLatitude(12)).toBe(AURORA_BOUNDARY_LATITUDES_BY_KP[9]);
  });

  it("treats non-finite readings as Kp 0", () => {
    expect(auroraBoundaryLatitude(Number.NaN)).toBe(AURORA_BOUNDARY_LATITUDES_BY_KP[0]);
  });
});

describe("AURORA_HORIZON_ALLOWANCE_DEG", () => {
  it("is a positive, modest number of degrees", () => {
    expect(AURORA_HORIZON_ALLOWANCE_DEG).toBeGreaterThan(0);
    expect(AURORA_HORIZON_ALLOWANCE_DEG).toBeLessThan(20);
  });
});

describe("auroraVisibilityMargin", () => {
  it("is zero when the observer sits exactly on the overhead boundary", () => {
    const boundary = auroraBoundaryLatitude(5);
    expect(auroraVisibilityMargin(5, boundary)).toBeCloseTo(0, 10);
  });

  it("is positive when the observer is poleward of the boundary", () => {
    expect(auroraVisibilityMargin(5, 70)).toBeGreaterThan(0);
  });

  it("is negative when the observer is equatorward of the boundary", () => {
    expect(auroraVisibilityMargin(5, 40)).toBeLessThan(0);
  });

  it("uses latitude magnitude so southern observers match", () => {
    expect(auroraVisibilityMargin(5, -70)).toBeCloseTo(auroraVisibilityMargin(5, 70), 10);
  });

  it("returns NaN for a non-finite observer latitude", () => {
    expect(auroraVisibilityMargin(5, Number.NaN)).toBeNaN();
  });
});
