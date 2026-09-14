/**
 * Visual-mode selection for the historical timeline.
 *
 * When the scrubber snaps to (or releases from) a historical event, the globe
 * switches into the mode that best frames that event. This decision was inline
 * in the `Timeline` pointer handler; extracting it here keeps the thresholds in
 * one named place and makes the mapping testable in isolation.
 */
import type { HistoricalEvent, VisualMode } from "../types/space";

/**
 * Minimum planetary K-index that qualifies an event as a geomagnetic storm for
 * the purpose of mode switching. NOAA classifies Kp 5 as the G1 storm
 * threshold, so any event above that is framed in STORM mode.
 */
export const TIMELINE_STORM_KP_THRESHOLD = 5;

/**
 * Returns the visual mode that should be shown for a snapped timeline event.
 *
 * An event with a K-index above {@link TIMELINE_STORM_KP_THRESHOLD} is a
 * geomagnetic storm and maps to `"STORM"`. Every other event — including one
 * with no K-index — and the "no event snapped" case (`null`) fall back to the
 * default `"OPS"` mode.
 */
export const modeForTimelineEvent = (event: HistoricalEvent | null): VisualMode => {
  if (event && event.kpIndex !== undefined && event.kpIndex > TIMELINE_STORM_KP_THRESHOLD) {
    return "STORM";
  }
  return "OPS";
};
