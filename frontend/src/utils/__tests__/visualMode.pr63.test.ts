import { describe, expect, it } from "vitest";

import type { HistoricalEvent } from "../../types/space";
import type { VisualMode } from "../../types/space";
import {
  STORM_KP_THRESHOLD,
  isStormModeActive,
  modeForShortcutKey,
  modeForTimelineEvent
} from "../visualMode";

const MODE_ORDER: VisualMode[] = ["OPS", "STORM", "INTEL", "HELIO"];

const makeEvent = (overrides: Partial<HistoricalEvent> = {}): HistoricalEvent => ({
  id: "evt",
  name: "Event",
  date: new Date("2015-03-17T00:00:00Z"),
  description: "",
  type: "solar_storm",
  ...overrides
});

describe("isStormModeActive", () => {
  it("is active whenever STORM mode is explicitly selected", () => {
    expect(isStormModeActive("STORM", 0)).toBe(true);
  });

  it("is active in any mode once Kp climbs past the threshold", () => {
    expect(isStormModeActive("OPS", STORM_KP_THRESHOLD + 0.1)).toBe(true);
    expect(isStormModeActive("INTEL", 8)).toBe(true);
  });

  it("is inactive in a non-storm mode at or below the threshold", () => {
    expect(isStormModeActive("OPS", STORM_KP_THRESHOLD)).toBe(false);
    expect(isStormModeActive("INTEL", 2)).toBe(false);
    expect(isStormModeActive("HELIO", 0)).toBe(false);
  });

  it("treats the threshold as exclusive", () => {
    expect(isStormModeActive("OPS", STORM_KP_THRESHOLD)).toBe(false);
    expect(isStormModeActive("OPS", STORM_KP_THRESHOLD + 0.01)).toBe(true);
  });
});

describe("modeForTimelineEvent", () => {
  it("falls back to OPS when no event is selected", () => {
    expect(modeForTimelineEvent(null)).toBe("OPS");
  });

  it("switches to STORM for an event whose Kp climbs past the threshold", () => {
    expect(modeForTimelineEvent(makeEvent({ kpIndex: STORM_KP_THRESHOLD + 0.1 }))).toBe("STORM");
    expect(modeForTimelineEvent(makeEvent({ kpIndex: 9 }))).toBe("STORM");
  });

  it("stays in OPS for an event at or below the threshold", () => {
    expect(modeForTimelineEvent(makeEvent({ kpIndex: STORM_KP_THRESHOLD }))).toBe("OPS");
    expect(modeForTimelineEvent(makeEvent({ kpIndex: 2 }))).toBe("OPS");
  });

  it("stays in OPS for an event with no recorded Kp index", () => {
    expect(modeForTimelineEvent(makeEvent({ type: "conjunction" }))).toBe("OPS");
  });
});

describe("modeForShortcutKey", () => {
  it("maps a 1-based digit to the mode at that position", () => {
    expect(modeForShortcutKey("1", MODE_ORDER)).toBe("OPS");
    expect(modeForShortcutKey("2", MODE_ORDER)).toBe("STORM");
    expect(modeForShortcutKey("4", MODE_ORDER)).toBe("HELIO");
  });

  it("returns null for digits outside the list range", () => {
    expect(modeForShortcutKey("0", MODE_ORDER)).toBeNull();
    expect(modeForShortcutKey("5", MODE_ORDER)).toBeNull();
  });

  it("returns null for non-numeric keys", () => {
    expect(modeForShortcutKey("Enter", MODE_ORDER)).toBeNull();
    expect(modeForShortcutKey(" ", MODE_ORDER)).toBeNull();
    expect(modeForShortcutKey("t", MODE_ORDER)).toBeNull();
  });
});
