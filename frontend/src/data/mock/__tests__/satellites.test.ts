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

});
