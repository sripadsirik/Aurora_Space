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
