import { Cartesian3, Cartographic, Math as CesiumMath } from "cesium";
import { describe, expect, it } from "vitest";
import { mockSatellites } from "../../data/mock/satellites";
import { satelliteSnapshotPosition } from "../satellitePosition";
import { getSatellitePositionOnOrbit } from "../orbit";

describe("live satellite placement", () => {
  it("preserves reported longitude, latitude and altitude rather than deriving an orbit from the NORAD id", () => {
    const satellite = { ...mockSatellites[0], lon: -122.4, lat: 37.8, altitudeKm: 420 };
    const point = Cartographic.fromCartesian(satelliteSnapshotPosition(satellite, true));
    expect(CesiumMath.toDegrees(point.longitude)).toBeCloseTo(-122.4, 8);
    expect(CesiumMath.toDegrees(point.latitude)).toBeCloseTo(37.8, 8);
    expect(point.height).toBeCloseTo(420_000, 4);
  });
  it("retains illustrative circular orbit placement for demo data", () => {
    const satellite = mockSatellites[0];
    expect(Cartesian3.equals(satelliteSnapshotPosition(satellite, false), getSatellitePositionOnOrbit(satellite))).toBe(true);
  });
});
