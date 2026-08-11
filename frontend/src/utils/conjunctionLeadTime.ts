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

/**
 * Lead-time bucket for a conjunction, ordered from most to least urgent:
 * `passed` (TCA already elapsed), `imminent`, `soon`, `upcoming`, and `later`.
 */
export type ConjunctionLeadTimeBucket = "passed" | "imminent" | "soon" | "upcoming" | "later";

/**
 * Lead-time buckets in urgency order, most urgent first. Handy for rendering a
 * stable set of rows or iterating tiers without re-listing the string union.
 */
export const CONJUNCTION_LEAD_TIME_BUCKETS: readonly ConjunctionLeadTimeBucket[] = [
  "passed",
  "imminent",
  "soon",
  "upcoming",
  "later"
] as const;

/**
 * Classifies a conjunction's TCA into a {@link ConjunctionLeadTimeBucket}
 * relative to `now`, using {@link CONJUNCTION_LEAD_TIME_THRESHOLDS_MINUTES}. A
 * TCA in the past is `passed`; otherwise the lead time is compared against the
 * `imminent`/`soon`/`upcoming` window bounds, falling through to `later`. Each
 * boundary is inclusive of its upper edge, so a lead time of exactly one hour is
 * `imminent`.
 */
export const classifyConjunctionLeadTime = (
  tca: Date | string,
  now: Date
): ConjunctionLeadTimeBucket => {
  const minutes = leadTimeMinutes(tca, now);
  if (minutes < 0) return "passed";
  if (minutes <= CONJUNCTION_LEAD_TIME_THRESHOLDS_MINUTES.imminent) return "imminent";
  if (minutes <= CONJUNCTION_LEAD_TIME_THRESHOLDS_MINUTES.soon) return "soon";
  if (minutes <= CONJUNCTION_LEAD_TIME_THRESHOLDS_MINUTES.upcoming) return "upcoming";
  return "later";
};

/**
 * Tallies how many conjunctions fall in each lead-time bucket relative to `now`.
 * Every bucket in {@link CONJUNCTION_LEAD_TIME_BUCKETS} is present in the result,
 * defaulting to zero, so a display can render a stable set of rows regardless of
 * the feed contents. The input is not mutated.
 */
export const countConjunctionsByLeadTime = (
  conjunctions: readonly ConjunctionWarning[],
  now: Date
): Record<ConjunctionLeadTimeBucket, number> => {
  const counts: Record<ConjunctionLeadTimeBucket, number> = {
    passed: 0,
    imminent: 0,
    soon: 0,
    upcoming: 0,
    later: 0
  };
  for (const conjunction of conjunctions) {
    counts[classifyConjunctionLeadTime(conjunction.tca, now)] += 1;
  }
  return counts;
};
