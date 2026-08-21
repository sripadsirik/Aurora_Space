import { describe, expect, it } from "vitest";
import { markerColorForEvent } from "../timelineMarkers";

describe("markerColorForEvent", () => {
  it("uses amber for solar storms", () => {
    expect(markerColorForEvent({ type: "solar_storm" })).toBe("#ff6622");
  });

  it("uses red for conjunctions", () => {
    expect(markerColorForEvent({ type: "conjunction" })).toBe("#ff2222");
  });

  it("uses pink for satellite losses", () => {
    expect(markerColorForEvent({ type: "satellite_loss" })).toBe("#ff4488");
  });
});
