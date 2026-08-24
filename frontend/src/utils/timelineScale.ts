import { clamp01 } from "./clamp";

/**
 * Maps a date onto its `0-1` position within the `[start, end]` window. Dates
 * before `start` clamp to 0 and dates after `end` clamp to 1. A degenerate
 * window (`end` at or before `start`) has no forward interior to interpolate,
 * so it collapses to 0 rather than producing `NaN` from a divide-by-zero.
 */
export const dateToFraction = (date: Date, start: Date, end: Date): number => {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  const offset = date.getTime() - start.getTime();
  return clamp01(offset / total);
};

/** Inverse of {@link dateToFraction}: maps a `0-1` fraction back to a date. */
export const fractionToDate = (fraction: number, start: Date, end: Date): Date => {
  const total = end.getTime() - start.getTime();
  return new Date(start.getTime() + fraction * total);
};

/** A labelled year gridline on the timeline: the year and its `0-1` position. */
export interface YearTick {
  year: number;
  fraction: number;
}

/**
 * Builds the year gridlines spanning the `[start, end]` window, one every
 * `stepYears` (default two) from the start year through the end year inclusive.
 * Each tick pairs its calendar year with the `0-1` track position of that year's
 * 1 January (UTC), so the caller can place it without re-deriving the geometry.
 */
export const buildYearTicks = (start: Date, end: Date, stepYears = 2): YearTick[] => {
  const ticks: YearTick[] = [];
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const step = Math.max(1, Math.trunc(stepYears));
  for (let year = startYear; year <= endYear; year += step) {
    const date = new Date(`${year}-01-01T00:00:00Z`);
    ticks.push({ year, fraction: dateToFraction(date, start, end) });
  }
  return ticks;
};

/**
 * Whether a scrubber `position` sits at the live edge of the timeline — within
 * `toleranceMs` (default one minute) of `now`. The timeline treats the live edge
 * as "following real time", so the caller uses this to decide when to show the
 * LIVE state rather than a historical-playback label.
 */
export const isAtLiveEdge = (position: Date, now: Date, toleranceMs = 60_000): boolean =>
  Math.abs(position.getTime() - now.getTime()) < toleranceMs;

/** Formats a date as a zero-padded UTC `YYYY-MM-DD` calendar day. */
export const formatTimelineDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
