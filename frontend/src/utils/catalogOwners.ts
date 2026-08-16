import type { RiskLevel, Satellite } from "../types/space";
import { filterElevatedRisk } from "./catalogFilters";

/**
 * Display label used when a satellite's owner field is blank or whitespace
 * only. Grouping still needs a stable key for these objects, and surfacing them
 * under an explicit bucket is clearer than silently dropping them.
 */
export const UNKNOWN_OWNER = "UNKNOWN";

/**
 * Normalises an owner label for grouping and comparison: trims surrounding
 * whitespace and folds case. Two satellites whose `owner` fields differ only in
 * spacing or capitalisation therefore collapse onto the same key.
 */
export const normalizeOwner = (owner: string): string => owner.trim().toLowerCase();

/**
 * Normalises an owner string to the label under which it should be displayed:
 * surrounding whitespace is trimmed, and a blank result collapses to
 * {@link UNKNOWN_OWNER}.
 */
export const canonicalOwner = (owner: string): string => {
  const trimmed = owner.trim();
  return trimmed.length === 0 ? UNKNOWN_OWNER : trimmed;
};

/**
 * The grouping key for an owner. Blank owners share the key of
 * {@link UNKNOWN_OWNER}, so an explicit `"UNKNOWN"` argument and an empty owner
 * field address the same bucket.
 */
const ownerKey = (owner: string): string => normalizeOwner(canonicalOwner(owner));

/** Accumulates a per-owner total, keyed for grouping and labelled for display. */
const tallyByOwner = (
  satellites: readonly Satellite[],
  valueOf: (satellite: Satellite) => number
): Record<string, number> => {
  const totals: Record<string, number> = {};
  const displayFor: Record<string, string> = {};
  for (const satellite of satellites) {
    const key = ownerKey(satellite.owner);
    if (displayFor[key] === undefined) {
      displayFor[key] = canonicalOwner(satellite.owner);
    }
    const display = displayFor[key];
    totals[display] = (totals[display] ?? 0) + valueOf(satellite);
  }
  return totals;
};

/**
 * Counts how many satellites each owner operates. Owners are grouped by their
 * {@link normalizeOwner normalised} label so that spacing and capitalisation
 * differences do not split a single operator across several buckets. The first
 * spelling encountered for an owner is used as the display key in the returned
 * record, preserving the catalog's own casing; blank owners are reported under
 * {@link UNKNOWN_OWNER}. The input is not mutated.
 */
export const countByOwner = (satellites: readonly Satellite[]): Record<string, number> =>
  tallyByOwner(satellites, () => 1);

/**
 * Returns the distinct operators in the catalog, sorted alphabetically
 * (case-insensitively). Owners are de-duplicated by their
 * {@link normalizeOwner normalised} label, and the first spelling encountered
 * for each is kept, so the result is a stable, display-ready list. The input is
 * not mutated.
 */
export const uniqueOwners = (satellites: readonly Satellite[]): string[] =>
  Object.keys(countByOwner(satellites)).sort((a, b) =>
    normalizeOwner(a).localeCompare(normalizeOwner(b))
  );

/** An operator paired with the number of catalog objects it operates. */
export interface OwnerCount {
  /** The operator's display label, in its first-seen catalog spelling. */
  owner: string;
  /** How many catalog objects that operator owns. */
  count: number;
}

/**
 * Returns operators ranked from largest to smallest fleet. Ties break
 * alphabetically (case-insensitively) so the ordering is deterministic for a
 * given catalog. Pass `limit` to keep only the busiest N operators; omit it (or
 * pass a non-positive value) to return every operator. The input is not
 * mutated.
 */
export const topOwnersByCount = (
  satellites: readonly Satellite[],
  limit?: number
): OwnerCount[] => {
  const ranked = Object.entries(countByOwner(satellites))
    .map(([owner, count]) => ({ owner, count }))
    .sort(
      (a, b) => b.count - a.count || normalizeOwner(a.owner).localeCompare(normalizeOwner(b.owner))
    );
  return limit !== undefined && limit > 0 ? ranked.slice(0, limit) : ranked;
};

/**
 * Sums each operator's per-object active conjunction counts. Like
 * {@link countByOwner}, operators are grouped by their
 * {@link normalizeOwner normalised} label and reported under their first-seen
 * spelling. This is a per-object tally, so a single conjunction shared by two of
 * an operator's objects contributes to that operator twice. The input is not
 * mutated.
 */
export const conjunctionsByOwner = (
  satellites: readonly Satellite[]
): Record<string, number> => tallyByOwner(satellites, (s) => s.conjunctionCount);

/**
 * Fraction of the catalog operated by `owner`, in the range `[0, 1]`. The owner
 * is matched by its {@link normalizeOwner normalised} label, so spacing and case
 * do not matter, and a blank argument matches the {@link UNKNOWN_OWNER} bucket.
 * Returns 0 for an empty catalog or an owner absent from it, so the figure is
 * always finite rather than `NaN`. The input is not mutated.
 */
export const ownerShare = (satellites: readonly Satellite[], owner: string): number => {
  if (satellites.length === 0) return 0;
  const target = ownerKey(owner);
  const owned = satellites.reduce(
    (count, satellite) => (ownerKey(satellite.owner) === target ? count + 1 : count),
    0
  );
  return owned / satellites.length;
};

/**
 * The 1-based rank of `owner` in the descending fleet-size ordering of
 * {@link topOwnersByCount}, or `null` when the operator is absent from the
 * catalog. The busiest operator ranks 1. Matching is case- and
 * whitespace-insensitive, and a blank argument ranks the {@link UNKNOWN_OWNER}
 * bucket. The input is not mutated.
 */
export const ownerRank = (satellites: readonly Satellite[], owner: string): number | null => {
  const target = ownerKey(owner);
  const index = topOwnersByCount(satellites).findIndex(
    (entry) => ownerKey(entry.owner) === target
  );
  return index === -1 ? null : index + 1;
};

/**
 * Tallies, per operator, the objects whose risk level is at or above
 * `threshold` in the ascending-severity order used across the catalog helpers.
 * This surfaces which operators carry the most flagged objects. It reuses
 * `filterElevatedRisk` for the threshold test and {@link topOwnersByCount} for
 * the grouping, so it shares their ordering and normalisation: results are
 * ordered most-to-least flagged objects, ties broken alphabetically, and
 * operators with no flagged objects are omitted entirely. The input is not
 * mutated.
 */
export const elevatedRiskByOwner = (
  satellites: Satellite[],
  threshold: RiskLevel = "watch"
): OwnerCount[] => topOwnersByCount(filterElevatedRisk(satellites, threshold));

/** An operator paired with its total number of active conjunctions. */
export interface OwnerConjunctions {
  /** The operator's display label, in its first-seen catalog spelling. */
  owner: string;
  /** Sum of the operator's per-object active conjunction counts. */
  conjunctions: number;
}

/**
 * Returns operators ranked from most to fewest total active conjunctions,
 * surfacing the operators carrying the most collision risk first. Ties break
 * alphabetically (case-insensitively) so the ordering is deterministic. Pass
 * `limit` to keep only the top N operators; omit it (or pass a non-positive
 * value) to return every operator. The input is not mutated.
 */
export const topOwnersByConjunctions = (
  satellites: readonly Satellite[],
  limit?: number
): OwnerConjunctions[] => {
  const ranked = Object.entries(conjunctionsByOwner(satellites))
    .map(([owner, conjunctions]) => ({ owner, conjunctions }))
    .sort(
      (a, b) =>
        b.conjunctions - a.conjunctions ||
        normalizeOwner(a.owner).localeCompare(normalizeOwner(b.owner))
    );
  return limit !== undefined && limit > 0 ? ranked.slice(0, limit) : ranked;
};

/** How many operators to surface in an {@link OwnerSummary} leaderboard. */
export const OWNER_LEADERBOARD_SIZE = 5;

/** Aggregate view of the operators behind a satellite catalog. */
export interface OwnerSummary {
  /** Number of distinct operators in the catalog. */
  totalOwners: number;
  /** Object counts keyed by operator. */
  byOwner: Record<string, number>;
  /**
   * The busiest operators by fleet size, at most
   * {@link OWNER_LEADERBOARD_SIZE} entries, ranked as by
   * {@link topOwnersByCount}.
   */
  topOwners: OwnerCount[];
  /** The single largest operator, or `null` for an empty catalog. */
  largestOwner: OwnerCount | null;
  /** Fraction of the catalog held by the largest operator, in `[0, 1]`. */
  largestShare: number;
}

/**
 * Bundles the owner aggregates into a single struct so a summary display can
 * derive every figure from one list. All members reuse the individual helpers
 * in this module, so they stay mutually consistent. `largestOwner` is the first
 * entry of the full ranking and therefore shares its deterministic tie-break.
 * The input is not mutated.
 */
export const summarizeOwners = (satellites: readonly Satellite[]): OwnerSummary => {
  const ranked = topOwnersByCount(satellites);
  const largestOwner = ranked[0] ?? null;
  return {
    totalOwners: ranked.length,
    byOwner: countByOwner(satellites),
    topOwners: ranked.slice(0, OWNER_LEADERBOARD_SIZE),
    largestOwner,
    largestShare: largestOwner === null ? 0 : ownerShare(satellites, largestOwner.owner)
  };
};
