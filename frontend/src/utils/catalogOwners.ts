import type { Satellite } from "../types/space";

/**
 * Display label used when a satellite's owner field is blank or whitespace
 * only. Grouping still needs a stable key for these objects, and surfacing them
 * under an explicit bucket is clearer than silently dropping them.
 */
export const UNKNOWN_OWNER = "UNKNOWN";

/**
 * Normalises an owner string to the label under which it should be displayed:
 * surrounding whitespace is trimmed, and a blank result collapses to
 * {@link UNKNOWN_OWNER}. Two owner strings that differ only in casing are
 * considered the same operator elsewhere in this module, but the first-seen
 * display form is what is preserved.
 */
export const canonicalOwner = (owner: string): string => {
  const trimmed = owner.trim();
  return trimmed.length === 0 ? UNKNOWN_OWNER : trimmed;
};

/** A single operator's share of the catalog. */
export interface OwnerCount {
  /** Owner label as it should be displayed. */
  owner: string;
  /** Number of tracked objects attributed to this owner. */
  count: number;
}

/**
 * Tallies the catalog by operator and returns one {@link OwnerCount} per
 * distinct owner. Owners are grouped case-insensitively and ignoring
 * surrounding whitespace — matching {@link canonicalOwner} and `filterByOwner`
 * — while the display label is the first spelling encountered. Blank owners are
 * grouped under {@link UNKNOWN_OWNER}. Results are ordered most-to-least objects,
 * ties broken alphabetically by owner label, so the ordering is stable for a
 * given catalog. The input is not mutated.
 */
export const countByOwner = (satellites: Satellite[]): OwnerCount[] => {
  const groups = new Map<string, OwnerCount>();
  for (const satellite of satellites) {
    const label = canonicalOwner(satellite.owner);
    const key = label.toLowerCase();
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { owner: label, count: 1 });
    } else {
      existing.count += 1;
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || a.owner.localeCompare(b.owner)
  );
};

/**
 * Number of distinct operators represented in the catalog, using the same
 * case-insensitive grouping as {@link countByOwner}. Blank owners collapse into
 * a single {@link UNKNOWN_OWNER} bucket, so they contribute at most one to the
 * total. Returns 0 for an empty catalog.
 */
export const distinctOwnerCount = (satellites: Satellite[]): number =>
  countByOwner(satellites).length;

/**
 * Returns the `limit` operators with the most tracked objects, in the
 * descending order of {@link countByOwner} (ties broken alphabetically). A
 * `limit` of zero or less yields an empty array, and a `limit` beyond the number
 * of distinct owners simply returns them all. The default surfaces the top five
 * operators, a convenient size for a leaderboard panel. The input is not
 * mutated.
 */
export const topOwners = (satellites: Satellite[], limit = 5): OwnerCount[] => {
  if (limit <= 0) return [];
  return countByOwner(satellites).slice(0, limit);
};

/**
 * The single operator with the most tracked objects, or `null` for an empty
 * catalog. Ties resolve alphabetically by owner label, matching
 * {@link countByOwner}, so the result is stable for a given catalog. The input
 * is not mutated.
 */
export const largestOperator = (satellites: Satellite[]): OwnerCount | null =>
  countByOwner(satellites)[0] ?? null;

/**
 * Fraction of the catalog attributed to `owner`, as a value in `[0, 1]`. The
 * owner is matched with the same case-insensitive, whitespace-insensitive rule
 * as {@link countByOwner}, and a blank argument matches the
 * {@link UNKNOWN_OWNER} bucket. Returns 0 for an empty catalog or an owner not
 * present, so the figure is always finite rather than `NaN`. Multiply by 100 for
 * a percentage.
 */
export const ownerShare = (satellites: Satellite[], owner: string): number => {
  if (satellites.length === 0) return 0;
  const key = canonicalOwner(owner).toLowerCase();
  const held = satellites.reduce(
    (count, satellite) =>
      canonicalOwner(satellite.owner).toLowerCase() === key ? count + 1 : count,
    0
  );
  return held / satellites.length;
};
