import { describe, expect, it } from "vitest";
import { dateToFraction, formatTimelineDate, fractionToDate } from "../timelineScale";

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
