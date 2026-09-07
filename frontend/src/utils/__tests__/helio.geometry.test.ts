import { Cartesian3, Math as CesiumMath } from "cesium";
import { describe, expect, it } from "vitest";
import { getHelioOrbitAngle } from "../helio";

describe("getHelioOrbitAngle", () => {
  const J2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));

  it("returns the phase at the J2000 reference epoch", () => {
    const phase = -CesiumMath.PI_OVER_TWO;
    expect(getHelioOrbitAngle(J2000, 365.25, phase)).toBeCloseTo(phase, 10);
  });

  it("advances a full turn after one orbital period", () => {
    const phase = 0;
    const oneYearLater = new Date(J2000.getTime() + 365.25 * 86_400_000);
    expect(getHelioOrbitAngle(oneYearLater, 365.25, phase)).toBeCloseTo(CesiumMath.TWO_PI, 8);
  });

  it("advances half a turn after half a period", () => {
    const halfLater = new Date(J2000.getTime() + (687 / 2) * 86_400_000);
    expect(getHelioOrbitAngle(halfLater, 687, 0)).toBeCloseTo(Math.PI, 8);
  });

  it("winds backwards for dates before the epoch", () => {
    const oneYearBefore = new Date(J2000.getTime() - 365.25 * 86_400_000);
    expect(getHelioOrbitAngle(oneYearBefore, 365.25, 0)).toBeCloseTo(-CesiumMath.TWO_PI, 8);
  });

  it("defaults the phase to a quarter turn behind", () => {
    expect(getHelioOrbitAngle(J2000, 365.25)).toBeCloseTo(-CesiumMath.PI_OVER_TWO, 10);
  });
});
