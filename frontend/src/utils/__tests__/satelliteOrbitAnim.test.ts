import { Math as CesiumMath } from "cesium";
import { describe, expect, it } from "vitest";
import type { SatelliteOrbitAnim } from "../satelliteOrbitAnim";
import { getSatellitePositionAtOffset, getSatelliteThetaAtElapsed } from "../satelliteOrbitAnim";

const baseState: SatelliteOrbitAnim = {
  radius: 7_000_000,
  inclination: 0,
  ascendingNode: 0,
  period: 3600,
  initialTheta: 0,
  thetaEpochSeconds: 0
};

describe("getSatelliteThetaAtElapsed", () => {
  it("returns the initial theta at the theta epoch", () => {
    expect(getSatelliteThetaAtElapsed(baseState, 0)).toBe(0);
  });

  it("advances a full turn after one orbital period", () => {
    expect(getSatelliteThetaAtElapsed(baseState, 3600)).toBeCloseTo(CesiumMath.TWO_PI, 10);
  });

  it("advances a quarter turn after a quarter period", () => {
    expect(getSatelliteThetaAtElapsed(baseState, 900)).toBeCloseTo(CesiumMath.PI_OVER_TWO, 10);
  });

  it("sweeps backward for times before the theta epoch", () => {
    expect(getSatelliteThetaAtElapsed(baseState, -900)).toBeCloseTo(-CesiumMath.PI_OVER_TWO, 10);
  });

  it("measures elapsed time relative to the theta epoch, not zero", () => {
    const shifted: SatelliteOrbitAnim = { ...baseState, thetaEpochSeconds: 900 };
    expect(getSatelliteThetaAtElapsed(shifted, 900)).toBe(0);
  });
});

describe("getSatellitePositionAtOffset", () => {
  it("places the satellite on the +x axis at the initial position", () => {
    const position = getSatellitePositionAtOffset(baseState, 0, 0);
    expect(position.x).toBeCloseTo(baseState.radius, 3);
    expect(position.y).toBeCloseTo(0, 3);
    expect(position.z).toBeCloseTo(0, 3);
  });

  it("looks a quarter period ahead with a positive offset", () => {
    const position = getSatellitePositionAtOffset(baseState, 0, baseState.period / 4);
    expect(position.x).toBeCloseTo(0, 3);
    expect(position.y).toBeCloseTo(baseState.radius, 3);
  });

  it("looks behind the current position with a negative offset", () => {
    const position = getSatellitePositionAtOffset(baseState, 0, -baseState.period / 4);
    expect(position.x).toBeCloseTo(0, 3);
    expect(position.y).toBeCloseTo(-baseState.radius, 3);
  });

  it("combines elapsed time and offset when projecting the position", () => {
    const combined = getSatellitePositionAtOffset(baseState, baseState.period / 8, baseState.period / 8);
    const equivalent = getSatellitePositionAtOffset(baseState, baseState.period / 4, 0);
    expect(combined.x).toBeCloseTo(equivalent.x, 6);
    expect(combined.y).toBeCloseTo(equivalent.y, 6);
  });
});
