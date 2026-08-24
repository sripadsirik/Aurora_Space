import { describe, expect, it } from "vitest";
import {
  AURORA_BOUNDARY_LATITUDES_BY_KP,
  AURORA_CHANCE_LABELS,
  AURORA_HORIZON_ALLOWANCE_DEG,
  auroraBoundaryLatitude,
  auroraVisibilityMargin,
  classifyAuroraChance,
  minimumKpForOverhead,
  summarizeAuroraVisibility
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

describe("classifyAuroraChance", () => {
  it("reports overhead when the observer is poleward of the boundary", () => {
    expect(classifyAuroraChance(5, 70)).toBe("overhead");
  });

  it("reports overhead exactly on the boundary", () => {
    expect(classifyAuroraChance(5, auroraBoundaryLatitude(5))).toBe("overhead");
  });

  it("reports a horizon glow just equatorward of the boundary", () => {
    const boundary = auroraBoundaryLatitude(5);
    expect(classifyAuroraChance(5, boundary - AURORA_HORIZON_ALLOWANCE_DEG / 2)).toBe("horizon");
  });

  it("includes the far edge of the horizon allowance", () => {
    const boundary = auroraBoundaryLatitude(5);
    expect(classifyAuroraChance(5, boundary - AURORA_HORIZON_ALLOWANCE_DEG)).toBe("horizon");
  });

  it("reports none well equatorward of the boundary", () => {
    expect(classifyAuroraChance(5, 20)).toBe("none");
  });

  it("reports none for a non-finite observer latitude", () => {
    expect(classifyAuroraChance(5, Number.NaN)).toBe("none");
  });
});

describe("AURORA_CHANCE_LABELS", () => {
  it("labels every chance tier", () => {
    expect(AURORA_CHANCE_LABELS.overhead).toBeTruthy();
    expect(AURORA_CHANCE_LABELS.horizon).toBeTruthy();
    expect(AURORA_CHANCE_LABELS.none).toBeTruthy();
  });
});

describe("minimumKpForOverhead", () => {
  it("needs no storm at very high latitude", () => {
    expect(minimumKpForOverhead(67)).toBe(0);
  });

  it("returns the first Kp whose boundary reaches the latitude", () => {
    // Kp 4's boundary is 58.3; an observer at 58.3 is reached first at Kp 4.
    expect(minimumKpForOverhead(58.3)).toBe(4);
  });

  it("requires a stronger storm at lower latitude", () => {
    const high = minimumKpForOverhead(60) ?? -1;
    const low = minimumKpForOverhead(50) ?? -1;
    expect(low).toBeGreaterThan(high);
  });

  it("returns null when even Kp 9 cannot reach the latitude", () => {
    expect(minimumKpForOverhead(30)).toBeNull();
  });

  it("uses latitude magnitude for southern observers", () => {
    expect(minimumKpForOverhead(-58.3)).toBe(4);
  });

  it("returns null for a non-finite latitude", () => {
    expect(minimumKpForOverhead(Number.NaN)).toBeNull();
  });
});

describe("summarizeAuroraVisibility", () => {
  it("agrees with the individual helpers", () => {
    const kp = 6;
    const latitude = 55;
    const summary = summarizeAuroraVisibility(kp, latitude);
    expect(summary.boundaryLatitude).toBe(auroraBoundaryLatitude(kp));
    expect(summary.margin).toBe(auroraVisibilityMargin(kp, latitude));
    expect(summary.chance).toBe(classifyAuroraChance(kp, latitude));
    expect(summary.chanceLabel).toBe(AURORA_CHANCE_LABELS[summary.chance]);
    expect(summary.minimumKpForOverhead).toBe(minimumKpForOverhead(latitude));
  });

  it("describes a high-latitude observer seeing an overhead aurora", () => {
    const summary = summarizeAuroraVisibility(7, 68);
    expect(summary.chance).toBe("overhead");
    expect(summary.margin).toBeGreaterThan(0);
  });

  it("describes a mid-latitude observer with no aurora during quiet conditions", () => {
    const summary = summarizeAuroraVisibility(1, 40);
    expect(summary.chance).toBe("none");
  });
});
