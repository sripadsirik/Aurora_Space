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
