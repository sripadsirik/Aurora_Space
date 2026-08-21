import { describe, expect, it } from "vitest";
import { buildYearTicks, dateToFraction, formatTimelineDate, fractionToDate } from "../timelineScale";

const start = new Date("2003-01-01T00:00:00Z");
const end = new Date("2023-01-01T00:00:00Z");

describe("dateToFraction", () => {
  it("maps the window endpoints to 0 and 1", () => {
    expect(dateToFraction(start, start, end)).toBe(0);
    expect(dateToFraction(end, start, end)).toBe(1);
  });

  it("maps the midpoint to 0.5", () => {
    const mid = new Date("2013-01-01T00:00:00Z");
    expect(dateToFraction(mid, start, end)).toBeCloseTo(0.5, 2);
  });

  it("clamps dates outside the window", () => {
    expect(dateToFraction(new Date("2000-01-01T00:00:00Z"), start, end)).toBe(0);
    expect(dateToFraction(new Date("2030-01-01T00:00:00Z"), start, end)).toBe(1);
  });

  it("collapses a zero-width window to 0 instead of NaN", () => {
    expect(dateToFraction(start, start, start)).toBe(0);
    expect(dateToFraction(end, start, start)).toBe(0);
  });

  it("collapses an inverted window to 0 instead of a spurious fraction", () => {
    const mid = new Date("2013-01-01T00:00:00Z");
    expect(dateToFraction(mid, end, start)).toBe(0);
  });
});

describe("fractionToDate", () => {
  it("inverts dateToFraction at the endpoints", () => {
    expect(fractionToDate(0, start, end).getTime()).toBe(start.getTime());
    expect(fractionToDate(1, start, end).getTime()).toBe(end.getTime());
  });

  it("round-trips an in-window date", () => {
    const date = new Date("2015-06-15T00:00:00Z");
    const fraction = dateToFraction(date, start, end);
    expect(fractionToDate(fraction, start, end).getTime()).toBe(date.getTime());
  });
});

describe("formatTimelineDate", () => {
  it("formats as zero-padded UTC YYYY-MM-DD", () => {
    expect(formatTimelineDate(new Date("2009-02-10T18:30:00Z"))).toBe("2009-02-10");
  });

  it("uses UTC rather than local time", () => {
    expect(formatTimelineDate(new Date("2020-12-31T23:59:59Z"))).toBe("2020-12-31");
  });
});

describe("buildYearTicks", () => {
  it("emits a tick every step years across the window, inclusive", () => {
    const ticks = buildYearTicks(start, end, 5);
    expect(ticks.map((t) => t.year)).toEqual([2003, 2008, 2013, 2018, 2023]);
  });

  it("defaults to a two-year step", () => {
    const ticks = buildYearTicks(new Date("2010-01-01T00:00:00Z"), new Date("2016-01-01T00:00:00Z"));
    expect(ticks.map((t) => t.year)).toEqual([2010, 2012, 2014, 2016]);
  });

  it("places each tick at its year's track fraction", () => {
    const ticks = buildYearTicks(start, end, 10);
    expect(ticks[0].fraction).toBe(0);
    expect(ticks[ticks.length - 1].fraction).toBe(1);
    const mid = ticks.find((t) => t.year === 2013);
    expect(mid?.fraction).toBeCloseTo(0.5, 2);
  });

  it("coerces a non-positive step to a single year so it always advances", () => {
    const ticks = buildYearTicks(new Date("2020-01-01T00:00:00Z"), new Date("2022-01-01T00:00:00Z"), 0);
    expect(ticks.map((t) => t.year)).toEqual([2020, 2021, 2022]);
  });
});
