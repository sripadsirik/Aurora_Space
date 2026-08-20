import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import {
  escapeVelocityKms,
  specificAngularMomentumKm2s,
  specificOrbitalEnergyMJ
} from "../orbitalEnergy";

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

describe("escapeVelocityKms", () => {
  it("is about 11.2 km/s at Earth's surface radius", () => {
    const vEsc = escapeVelocityKms(6_371_000);
    expect(vEsc).toBeGreaterThan(11.1);
    expect(vEsc).toBeLessThan(11.3);
  });

  it("falls off as the orbit radius grows", () => {
    expect(escapeVelocityKms(42_164_000)).toBeLessThan(escapeVelocityKms(6_800_000));
  });

  it("is sqrt(2) times the circular orbital speed at the same radius", () => {
    const radius = 7_000_000;
    const circular = Math.sqrt(3.986004418e14 / radius) / 1000;
    expect(escapeVelocityKms(radius)).toBeCloseTo(circular * Math.SQRT2, 9);
  });
});

describe("specificAngularMomentumKm2s", () => {
  it("is positive and grows with the orbit radius", () => {
    const low = specificAngularMomentumKm2s(6_800_000);
    const high = specificAngularMomentumKm2s(42_164_000);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
  });

  it("equals the radius times the circular speed (r * v)", () => {
    const radius = 7_000_000;
    const circularKms = Math.sqrt(3.986004418e14 / radius) / 1000;
    const radiusKm = radius / 1000;
    expect(specificAngularMomentumKm2s(radius)).toBeCloseTo(radiusKm * circularKms, 3);
  });
});
