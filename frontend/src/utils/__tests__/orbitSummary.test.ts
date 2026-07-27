import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import { getOrbitalPeriodMinutes } from "../orbitSummary";

const makeSatellite = (overrides: Partial<Satellite> = {}): Satellite => ({
  noradId: 1,
  name: "TEST",
  lat: 0,
  lon: 0,
  altitudeKm: 420,
  velocityKms: 7.6,
  orbitType: "LEO",
  riskLevel: "nominal",
  owner: "TEST",
  conjunctionCount: 0,
  ...overrides
});

describe("getOrbitalPeriodMinutes", () => {
  it("matches the ~92 minute period of a low Earth orbit", () => {
    const period = getOrbitalPeriodMinutes(makeSatellite({ altitudeKm: 420 }));
    expect(period).toBeGreaterThan(88);
    expect(period).toBeLessThan(94);
  });

  it("matches the ~24 hour period of a geostationary orbit", () => {
    const period = getOrbitalPeriodMinutes(makeSatellite({ altitudeKm: 35_786, orbitType: "GEO" }));
    expect(period / 60).toBeGreaterThan(23.5);
    expect(period / 60).toBeLessThan(24.5);
  });

  it("grows with altitude", () => {
    const low = getOrbitalPeriodMinutes(makeSatellite({ altitudeKm: 400 }));
    const high = getOrbitalPeriodMinutes(makeSatellite({ altitudeKm: 1200 }));
    expect(high).toBeGreaterThan(low);
  });
});
