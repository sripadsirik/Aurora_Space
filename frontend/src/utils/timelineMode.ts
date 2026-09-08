/**
 * Visual-mode selection for the historical timeline scrubber.
 *
 * When the scrubber snaps to a historical event, the view switches to STORM for
 * geomagnetic storms and back to OPS otherwise. That decision was inlined in the
 * `Timeline` pointer handler as a bare `kpIndex > 5` check; pulling it here keeps
 * it testable and ties it to the same {@link STORM_KP_THRESHOLD} the live storm
 * overlay uses, so a replayed storm and a live one agree on what counts.
 */

import type { HistoricalEvent, VisualMode } from "../types/space";

import { isStormLevelKp } from "./visualMode";

/**
 * The visual mode to show for a snapped timeline event: STORM when the event
 * carries a storm-level Kp index ({@link isStormLevelKp}), otherwise OPS. A
 * `null` event (the scrubber sitting between events) or one without a Kp reading
 * falls back to OPS.
 */
export const modeForTimelineEvent = (event: HistoricalEvent | null): VisualMode => {
  if (event && event.kpIndex !== undefined && isStormLevelKp(event.kpIndex)) {
    return "STORM";
  }
  return "OPS";
};
