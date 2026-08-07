import { describe, expect, it } from "vitest";
import type { HistoricalEvent } from "../../types/space";
import {
  countByEventType,
  eventsInDateRange,
  filterByEventType,
  sortByDate
} from "../historicalEventStats";

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

describe("sortByDate", () => {
  const older = makeEvent({ id: "older", date: new Date("2003-10-28T00:00:00Z") });
  const middle = makeEvent({ id: "middle", date: new Date("2017-09-06T00:00:00Z") });
  const newer = makeEvent({ id: "newer", date: new Date("2025-05-12T00:00:00Z") });

  it("orders oldest-first by default", () => {
    const sorted = sortByDate([middle, newer, older]);
    expect(sorted.map((e) => e.id)).toEqual(["older", "middle", "newer"]);
  });

  it("orders newest-first when direction is desc", () => {
    const sorted = sortByDate([middle, older, newer], "desc");
    expect(sorted.map((e) => e.id)).toEqual(["newer", "middle", "older"]);
  });

  it("does not mutate the input array", () => {
    const input = [middle, older, newer];
    sortByDate(input);
    expect(input.map((e) => e.id)).toEqual(["middle", "older", "newer"]);
  });
});

describe("filterByEventType", () => {
  const events: HistoricalEvent[] = [
    makeEvent({ id: "a", type: "solar_storm" }),
    makeEvent({ id: "b", type: "conjunction" }),
    makeEvent({ id: "c", type: "solar_storm" }),
    makeEvent({ id: "d", type: "satellite_loss" })
  ];

  it("keeps only events of the requested category, in input order", () => {
    expect(filterByEventType(events, "solar_storm").map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("returns an empty array when no events match", () => {
    expect(filterByEventType([], "conjunction")).toEqual([]);
  });
});

describe("eventsInDateRange", () => {
  const y2003 = makeEvent({ id: "y2003", date: new Date("2003-10-28T00:00:00Z") });
  const y2017 = makeEvent({ id: "y2017", date: new Date("2017-09-06T00:00:00Z") });
  const y2025 = makeEvent({ id: "y2025", date: new Date("2025-05-12T00:00:00Z") });
  const events = [y2003, y2017, y2025];

  it("keeps events within the inclusive range, in input order", () => {
    const result = eventsInDateRange(
      events,
      new Date("2010-01-01T00:00:00Z"),
      new Date("2020-01-01T00:00:00Z")
    );
    expect(result.map((e) => e.id)).toEqual(["y2017"]);
  });

  it("includes events landing exactly on either bound", () => {
    const result = eventsInDateRange(
      events,
      new Date("2003-10-28T00:00:00Z"),
      new Date("2017-09-06T00:00:00Z")
    );
    expect(result.map((e) => e.id)).toEqual(["y2003", "y2017"]);
  });

  it("yields no matches for a reversed range", () => {
    const result = eventsInDateRange(
      events,
      new Date("2020-01-01T00:00:00Z"),
      new Date("2010-01-01T00:00:00Z")
    );
    expect(result).toEqual([]);
  });
});
