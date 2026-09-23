import { describe, expect, it } from "vitest";

import type { HistoricalEvent } from "../../types/space";
import { TIMELINE_STORM_KP_THRESHOLD, modeForTimelineEvent } from "../timelineMode";

const makeEvent = (overrides: Partial<HistoricalEvent> = {}): HistoricalEvent => ({
  id: "evt",
  name: "Test Event",
  date: new Date("2015-03-17T00:00:00Z"),
  description: "",
  type: "solar_storm",
  ...overrides
});

describe("modeForTimelineEvent", () => {
  it("returns OPS when no event is snapped", () => {
    expect(modeForTimelineEvent(null)).toBe("OPS");
  });

  it("returns STORM for an event above the storm Kp threshold", () => {
    expect(modeForTimelineEvent(makeEvent({ kpIndex: 8 }))).toBe("STORM");
  });

  it("returns OPS for an event at the storm Kp threshold", () => {
    expect(modeForTimelineEvent(makeEvent({ kpIndex: TIMELINE_STORM_KP_THRESHOLD }))).toBe("OPS");
  });

  it("returns STORM just above the threshold and OPS just below", () => {
    expect(modeForTimelineEvent(makeEvent({ kpIndex: TIMELINE_STORM_KP_THRESHOLD + 0.1 }))).toBe("STORM");
    expect(modeForTimelineEvent(makeEvent({ kpIndex: TIMELINE_STORM_KP_THRESHOLD - 0.1 }))).toBe("OPS");
  });

  it("returns OPS for an event with no K-index", () => {
    expect(modeForTimelineEvent(makeEvent({ kpIndex: undefined }))).toBe("OPS");
  });

  it("exposes the storm threshold at the NOAA G1 boundary", () => {
    expect(TIMELINE_STORM_KP_THRESHOLD).toBe(5);
  });
});
