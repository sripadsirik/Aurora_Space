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

/** The two glyphs the timeline draws for a historical-event marker. */
export type MarkerShape = "dot" | "x";

/**
 * Glyph used to draw the timeline marker for a historical event. Conjunctions
 * render as an `x` to echo the `object1 x object2` pairing shown elsewhere;
 * every other category renders as a `dot`.
 */
export const markerShapeForEvent = (event: Pick<HistoricalEvent, "type">): MarkerShape =>
  event.type === "conjunction" ? "x" : "dot";
