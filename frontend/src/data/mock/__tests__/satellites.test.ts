import { describe, expect, it } from "vitest";
import { mockSatellites } from "../satellites";

describe("mockSatellites dataset", () => {
  it("contains exactly 150 satellites", () => {
    expect(mockSatellites).toHaveLength(150);
  });

  it("assigns a unique NORAD id to every satellite", () => {
    const ids = mockSatellites.map((satellite) => satellite.noradId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every latitude and longitude within valid geographic bounds", () => {
    for (const satellite of mockSatellites) {
      expect(satellite.lat).toBeGreaterThanOrEqual(-90);
      expect(satellite.lat).toBeLessThanOrEqual(90);
      expect(satellite.lon).toBeGreaterThanOrEqual(-180);
      expect(satellite.lon).toBeLessThanOrEqual(180);
    }
  });

  it("gives every satellite a positive altitude", () => {
    for (const satellite of mockSatellites) {
      expect(satellite.altitudeKm).toBeGreaterThan(0);
    }
  });

  it("keeps orbital velocity within the clamp band for each orbit type", () => {
    const bounds: Record<string, [number, number]> = {
      LEO: [7.2, 8.0],
      MEO: [3.5, 4.5],
      GEO: [2.95, 3.1]
    };
    for (const satellite of mockSatellites) {
      const [min, max] = bounds[satellite.orbitType];
      expect(satellite.velocityKms).toBeGreaterThanOrEqual(min);
      expect(satellite.velocityKms).toBeLessThanOrEqual(max);
    }
  });

  it("only uses known orbit types and risk levels", () => {
    const orbitTypes = new Set(["LEO", "MEO", "GEO"]);
    const riskLevels = new Set(["nominal", "watch", "warning", "critical"]);
    for (const satellite of mockSatellites) {
      expect(orbitTypes.has(satellite.orbitType)).toBe(true);
      expect(riskLevels.has(satellite.riskLevel)).toBe(true);
    }
  });

  it("keeps the conjunction count in the range implied by each risk level", () => {
    const ranges: Record<string, [number, number]> = {
      critical: [3, 3],
      warning: [2, 3],
      watch: [1, 2],
      nominal: [0, 1]
    };
    for (const satellite of mockSatellites) {
      const [min, max] = ranges[satellite.riskLevel];
      expect(satellite.conjunctionCount).toBeGreaterThanOrEqual(min);
      expect(satellite.conjunctionCount).toBeLessThanOrEqual(max);
    }
  });
});
