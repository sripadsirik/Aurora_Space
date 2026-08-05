import { describe, expect, it } from "vitest";
import { getStormAssetRiskCounts } from "../stormAssets";
import type { Satellite } from "../../types/space";

const makeSat = (overrides: Partial<Satellite>): Satellite => ({
  noradId: 1,
  name: "TEST",
  lat: 0,
  lon: 0,
  altitudeKm: 550,
  velocityKms: 7.6,
  orbitType: "LEO",
  riskLevel: "nominal",
  owner: "USA",
  conjunctionCount: 0,
  ...overrides
});

describe("getStormAssetRiskCounts", () => {
  it("returns zeros for an empty catalogue", () => {
    expect(getStormAssetRiskCounts([])).toEqual({ leo: 0, geo: 0, debris: 0 });
  });

  it("counts LEO objects strictly below 2000 km", () => {
    const sats = [
      makeSat({ altitudeKm: 400 }),
      makeSat({ altitudeKm: 1999 }),
      makeSat({ altitudeKm: 2000 }),
      makeSat({ altitudeKm: 36000 })
    ];
    expect(getStormAssetRiskCounts(sats).leo).toBe(2);
  });

  it("counts GEO objects strictly above 35000 km", () => {
    const sats = [
      makeSat({ altitudeKm: 35000 }),
      makeSat({ altitudeKm: 35001 }),
      makeSat({ altitudeKm: 35786 })
    ];
    expect(getStormAssetRiskCounts(sats).geo).toBe(2);
  });

  it("counts debris by the DEBRIS owner tag", () => {
    const sats = [
      makeSat({ owner: "DEBRIS" }),
      makeSat({ owner: "DEBRIS" }),
      makeSat({ owner: "ESA" })
    ];
    expect(getStormAssetRiskCounts(sats).debris).toBe(2);
  });

  it("counts categories independently for an object that is both LEO and debris", () => {
    const counts = getStormAssetRiskCounts([makeSat({ altitudeKm: 800, owner: "DEBRIS" })]);
    expect(counts).toEqual({ leo: 1, geo: 0, debris: 1 });
  });
});
