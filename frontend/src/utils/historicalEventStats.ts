import type { HistoricalEvent } from "../types/space";

/** The categories a historical event can fall into, in a stable display order. */
export const EVENT_TYPES: readonly HistoricalEvent["type"][] = [
  "solar_storm",
  "conjunction",
  "satellite_loss"
] as const;

/**
 * Counts how many events fall in each category. Every type in
 * {@link EVENT_TYPES} is present in the result, defaulting to zero, so a summary
 * display can render a stable set of rows regardless of the feed contents.
 */
export const countByEventType = (
  events: readonly HistoricalEvent[]
): Record<HistoricalEvent["type"], number> => {
  const counts: Record<HistoricalEvent["type"], number> = {
    solar_storm: 0,
    conjunction: 0,
    satellite_loss: 0
  };
  for (const event of events) {
    counts[event.type] += 1;
  }
  return counts;
};

/**
 * Returns a new array of the events ordered by date. The default `"asc"`
 * direction runs oldest-first, matching a left-to-right timeline; `"desc"` runs
 * newest-first for a most-recent-at-top list. Ties preserve input order and the
 * input array is never mutated.
 */
export const sortByDate = (
  events: readonly HistoricalEvent[],
  direction: "asc" | "desc" = "asc"
): HistoricalEvent[] => {
  const sign = direction === "asc" ? 1 : -1;
  return [...events].sort((a, b) => sign * (a.date.getTime() - b.date.getTime()));
};

/**
 * Returns a new array of the events whose category matches `type`, preserving
 * input order. The input array is never mutated.
 */
export const filterByEventType = (
  events: readonly HistoricalEvent[],
  type: HistoricalEvent["type"]
): HistoricalEvent[] => events.filter((event) => event.type === type);
