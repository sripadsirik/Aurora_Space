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
});
