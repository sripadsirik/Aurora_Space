import { describe, expect, it } from "vitest";
import { AURORA_BOUNDARY_LATITUDES_BY_KP } from "../auroraVisibility";

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
