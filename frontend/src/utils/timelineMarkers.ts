import type { HistoricalEvent } from "../types/space";

/**
 * Presentation helpers for the historical-event markers drawn on the timeline
 * track. The mapping from an event's `type` onto its marker colour and shape is
 * pure look-up logic that the `Timeline` component rendered inline; centralising
 * it here keeps the marker styling consistent and gives it a tested home.
 */

/** Marker fill/stroke colour for each historical-event category. */
const MARKER_COLORS: Record<HistoricalEvent["type"], string> = {
  solar_storm: "#ff6622",
  conjunction: "#ff2222",
  satellite_loss: "#ff4488"
};

/**
 * Colour used to draw the timeline marker for a historical event, keyed off its
 * `type`: solar storms are amber, conjunctions red, and satellite losses pink.
 */
export const markerColorForEvent = (event: Pick<HistoricalEvent, "type">): string =>
  MARKER_COLORS[event.type];
