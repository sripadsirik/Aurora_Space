/**
 * Selection helpers for the historical events pinned to the timeline track.
 *
 * When the scrubber is dragged, the `Timeline` component snaps to the nearest
 * event whose track position is within a small tolerance of the cursor. That
 * nearest-within-tolerance search is pure geometry that was buried inside a
 * pointer handler; extracting it here makes the snap behaviour testable and
 * keeps the tolerance in one named place.
 */

/**
 * Default snap tolerance, expressed as a fraction of the full timeline width.
 * An event is a snap candidate only when its marker sits within this fraction
 * of the scrubber.
 */
export const TIMELINE_SNAP_TOLERANCE = 0.015;

/**
 * Returns the event whose track fraction is closest to `targetFraction`, or
 * `null` when none falls within `tolerance`. `fractionOf` maps an event onto its
 * `0-1` position along the track. Ties resolve to the earliest such event in the
 * list, matching a single left-to-right pass.
 */
export const findNearestEvent = <T>(
  events: readonly T[],
  targetFraction: number,
  fractionOf: (event: T) => number,
  tolerance: number = TIMELINE_SNAP_TOLERANCE
): T | null => {
  let nearest: T | null = null;
  let nearestDistance = Infinity;
  for (const event of events) {
    const distance = Math.abs(fractionOf(event) - targetFraction);
    if (distance < tolerance && distance < nearestDistance) {
      nearest = event;
      nearestDistance = distance;
    }
  }
  return nearest;
};
