import { describe, expect, it } from "vitest";

import type { HistoricalEvent } from "../../types/space";
import { STORM_KP_THRESHOLD } from "../visualMode";
import { modeForTimelineEvent } from "../timelineMode";

const makeEvent = (overrides: Partial<HistoricalEvent> = {}): HistoricalEvent => ({
  id: "evt",
  name: "Test Event",
  date: new Date("2010-01-01T00:00:00Z"),
  description: "",
  type: "solar_storm",
  ...overrides
});

describe("modeForTimelineEvent", () => {
  it("returns STORM for an event with a storm-level Kp index", () => {
    expect(modeForTimelineEvent(makeEvent({ kpIndex: STORM_KP_THRESHOLD + 0.5 }))).toBe("STORM");
    expect(modeForTimelineEvent(makeEvent({ kpIndex: 9 }))).toBe("STORM");
  });

  it("returns OPS for an event at or below the threshold", () => {
    expect(modeForTimelineEvent(makeEvent({ kpIndex: STORM_KP_THRESHOLD }))).toBe("OPS");
    expect(modeForTimelineEvent(makeEvent({ kpIndex: 2 }))).toBe("OPS");
  });

  it("returns OPS for an event without a Kp reading", () => {
    expect(modeForTimelineEvent(makeEvent({ type: "conjunction" }))).toBe("OPS");
  });

  it("returns OPS when the scrubber is between events", () => {
    expect(modeForTimelineEvent(null)).toBe("OPS");
  });
});
