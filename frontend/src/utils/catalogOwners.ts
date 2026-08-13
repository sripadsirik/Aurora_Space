import type { Satellite } from "../types/space";

/**
 * Normalises an owner label for grouping and comparison: trims surrounding
 * whitespace and folds case. Two satellites whose `owner` fields differ only in
 * spacing or capitalisation therefore collapse onto the same key.
 */
export const normalizeOwner = (owner: string): string => owner.trim().toLowerCase();

/**
 * Counts how many satellites each owner operates. Owners are grouped by their
 * {@link normalizeOwner normalised} label so that spacing and capitalisation
 * differences do not split a single operator across several buckets. The first
 * spelling encountered for an owner is used as the display key in the returned
 * record, preserving the catalog's own casing. The input is not mutated.
 */
export const countByOwner = (satellites: readonly Satellite[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  const displayFor: Record<string, string> = {};
  for (const satellite of satellites) {
    const key = normalizeOwner(satellite.owner);
    if (displayFor[key] === undefined) {
      displayFor[key] = satellite.owner.trim();
    }
    const display = displayFor[key];
    counts[display] = (counts[display] ?? 0) + 1;
  }
  return counts;
};

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
): Record<string, number> => {
  const totals: Record<string, number> = {};
  const displayFor: Record<string, string> = {};
  for (const satellite of satellites) {
    const key = normalizeOwner(satellite.owner);
    if (displayFor[key] === undefined) {
      displayFor[key] = satellite.owner.trim();
    }
    const display = displayFor[key];
    totals[display] = (totals[display] ?? 0) + satellite.conjunctionCount;
  }
  return totals;
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
  return {
    totalOwners: ranked.length,
    byOwner: countByOwner(satellites),
    topOwners: ranked.slice(0, OWNER_LEADERBOARD_SIZE),
    largestOwner: ranked[0] ?? null
  };
};
