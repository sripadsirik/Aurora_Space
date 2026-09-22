import type { HistoricalEvent, VisualMode } from "../types/space";

/** Kp index above which geomagnetic activity is treated as an active storm. */
export const STORM_KP_THRESHOLD = 5;

/**
 * Whether the storm treatment (warm palette, storm overlay, auto-trigger) should
 * be active. True when the operator has explicitly selected STORM mode, or when
 * the effective Kp index has climbed past {@link STORM_KP_THRESHOLD} regardless
 * of the current mode.
 */
export const isStormModeActive = (mode: VisualMode, kpIndex: number): boolean =>
  mode === "STORM" || kpIndex > STORM_KP_THRESHOLD;

/**
 * The visual mode the timeline should switch to when a historical event is
 * scrubbed into (or `null` when the scrubber leaves every event). A stormy event
 * — one whose Kp index climbs past {@link STORM_KP_THRESHOLD} — opens in STORM
 * mode so the warm palette and impact panels come up; everything else, including
 * events with no recorded Kp, falls back to the OPS operator dashboard.
 */
export const modeForTimelineEvent = (event: HistoricalEvent | null): VisualMode => {
  if (event && event.kpIndex !== undefined && event.kpIndex > STORM_KP_THRESHOLD) {
    return "STORM";
  }
  return "OPS";
};

/**
 * Resolves a numeric keyboard shortcut to the visual mode at that 1-based
 * position in `modes` (so `"1"` selects the first mode, `"2"` the second, and so
 * on). Returns `null` for any key that is not a whole number within range,
 * letting the caller drive selection off the same ordered list the UI renders
 * rather than a hardcoded key count.
 */
export const modeForShortcutKey = (
  key: string,
  modes: readonly VisualMode[]
): VisualMode | null => {
  const index = Number.parseInt(key, 10);
  if (!Number.isInteger(index) || index < 1 || index > modes.length) {
    return null;
  }
  return modes[index - 1];
};
