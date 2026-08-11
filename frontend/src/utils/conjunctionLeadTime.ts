import type { ConjunctionWarning } from "../types/space";

/**
 * Upper bounds, in minutes of lead time, that separate the conjunction
 * lead-time buckets. A conjunction whose time of closest approach (TCA) is at or
 * below a threshold — and above the previous one — falls into that bucket:
 * `imminent` (≤ 1 hour), `soon` (≤ 6 hours), `upcoming` (≤ 24 hours). Anything
 * further out is `later`, and a TCA in the past is `passed`. These windows are
 * shared by the timeline and conjunction panels so lead-time grouping stays
 * consistent across the UI.
 */
export const CONJUNCTION_LEAD_TIME_THRESHOLDS_MINUTES = {
  imminent: 60,
  soon: 360,
  upcoming: 1440
} as const;

/**
 * Signed lead time in minutes from `now` to a conjunction's TCA. Positive when
 * the TCA is still in the future and negative once it has elapsed. Accepts a
 * `Date` or ISO string for the TCA. The value is not rounded, so callers can
 * apply their own precision.
 */
export const leadTimeMinutes = (tca: Date | string, now: Date): number => {
  const tcaDate = tca instanceof Date ? tca : new Date(tca);
  return (tcaDate.getTime() - now.getTime()) / 60_000;
};
