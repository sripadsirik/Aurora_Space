import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import { STORM_EXPOSURE_THRESHOLDS, countStormExposedAssets } from "../stormExposure";

const makeSatellite = (overrides: Partial<Satellite> = {}): Satellite => ({
  noradId: 1,
  name: "TEST",
  lat: 0,
  lon: 0,
  altitudeKm: 500,
  velocityKms: 7.6,
  orbitType: "LEO",
  riskLevel: "nominal",
  owner: "TEST",
  conjunctionCount: 0,
  ...overrides
});

describe("countStormExposedAssets", () => {
  it("counts low-orbit objects as drag-exposed", () => {
    const catalog = [makeSatellite({ altitudeKm: 400 }), makeSatellite({ altitudeKm: 1800 })];
    expect(countStormExposedAssets(catalog).leoDrag).toBe(2);
  });

  it("counts high-altitude objects as charging-exposed", () => {
    const catalog = [makeSatellite({ altitudeKm: 35786 }), makeSatellite({ altitudeKm: 500 })];
    expect(countStormExposedAssets(catalog).geoCharging).toBe(1);
  });

  it("counts debris-owned objects separately", () => {
    const catalog = [makeSatellite({ owner: "DEBRIS" }), makeSatellite({ owner: "NASA" })];
    expect(countStormExposedAssets(catalog).debris).toBe(1);
  });

  it("lets a single object contribute to overlapping buckets", () => {
    const debrisInLeo = makeSatellite({ altitudeKm: 600, owner: "DEBRIS" });
    expect(countStormExposedAssets([debrisInLeo])).toEqual({ leoDrag: 1, geoCharging: 0, debris: 1 });
  });

  it("excludes objects exactly on the altitude thresholds", () => {
    const onCeiling = makeSatellite({ altitudeKm: STORM_EXPOSURE_THRESHOLDS.leoCeilingKm });
    const onFloor = makeSatellite({ altitudeKm: STORM_EXPOSURE_THRESHOLDS.geoFloorKm });
    expect(countStormExposedAssets([onCeiling, onFloor])).toEqual({ leoDrag: 0, geoCharging: 0, debris: 0 });
  });

  it("returns all-zero counts for an empty catalog", () => {
    expect(countStormExposedAssets([])).toEqual({ leoDrag: 0, geoCharging: 0, debris: 0 });
  });
});
