import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import { specificOrbitalEnergyMJ } from "../orbitalEnergy";

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

describe("specificOrbitalEnergyMJ", () => {
  it("is negative for a bound orbit", () => {
    expect(specificOrbitalEnergyMJ(6_800_000)).toBeLessThan(0);
  });

  it("rises toward zero as the orbit radius grows", () => {
    const low = specificOrbitalEnergyMJ(6_800_000);
    const high = specificOrbitalEnergyMJ(42_164_000);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThan(0);
  });

  it("matches the analytic -mu / (2r) value for a low Earth orbit", () => {
    const radius = 6_791_000;
    const expected = -3.986004418e14 / (2 * radius) / 1e6;
    expect(specificOrbitalEnergyMJ(radius)).toBeCloseTo(expected, 9);
  });
});
