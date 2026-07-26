/**
 * Maps a date onto its `0-1` position within the `[start, end]` window. Dates
 * before `start` clamp to 0 and dates after `end` clamp to 1.
 */
export const dateToFraction = (date: Date, start: Date, end: Date): number => {
  const total = end.getTime() - start.getTime();
  const offset = date.getTime() - start.getTime();
  return Math.max(0, Math.min(1, offset / total));
};

/** Inverse of {@link dateToFraction}: maps a `0-1` fraction back to a date. */
export const fractionToDate = (fraction: number, start: Date, end: Date): Date => {
  const total = end.getTime() - start.getTime();
  return new Date(start.getTime() + fraction * total);
};

/** Formats a date as a zero-padded UTC `YYYY-MM-DD` calendar day. */
export const formatTimelineDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
