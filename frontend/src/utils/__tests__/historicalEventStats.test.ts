import { describe, expect, it } from "vitest";
import type { HistoricalEvent } from "../../types/space";
import { countByEventType } from "../historicalEventStats";

const makeEvent = (overrides: Partial<HistoricalEvent> = {}): HistoricalEvent => ({
  id: "evt",
  name: "Test Event",
  date: new Date("2010-01-01T00:00:00Z"),
  description: "A test event.",
  type: "solar_storm",
  ...overrides
});

describe("countByEventType", () => {
  it("tallies events into their categories", () => {
    const events: HistoricalEvent[] = [
      makeEvent({ id: "a", type: "solar_storm" }),
      makeEvent({ id: "b", type: "solar_storm" }),
      makeEvent({ id: "c", type: "conjunction" }),
      makeEvent({ id: "d", type: "satellite_loss" })
    ];
    expect(countByEventType(events)).toEqual({
      solar_storm: 2,
      conjunction: 1,
      satellite_loss: 1
    });
  });

  it("returns every category at zero for an empty feed", () => {
    expect(countByEventType([])).toEqual({
      solar_storm: 0,
      conjunction: 0,
      satellite_loss: 0
    });
  });
});
