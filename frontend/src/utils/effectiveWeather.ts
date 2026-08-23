import type { HistoricalEvent, SpaceWeather } from "../types/space";

/** The subset of space-weather scalars that a timeline event may override. */
export interface EffectiveWeather {
  kpIndex: number;
  solarWindSpeed: number;
  bzComponent: number;
  stormLevel: SpaceWeather["stormLevel"];
}

/**
 * Overlays an optional scrubbed timeline event on top of the live space-weather
 * feed, returning the values that should actually be displayed. Each field falls
 * back to the live feed when the timeline event is absent or omits that field, so
 * scrubbing to a historical event shows its recorded conditions while live view
 * shows the current feed.
 */
export const resolveEffectiveWeather = (
  timelineEvent: HistoricalEvent | null,
  spaceWeather: SpaceWeather
): EffectiveWeather => ({
  kpIndex: timelineEvent?.kpIndex ?? spaceWeather.kpIndex,
  solarWindSpeed: timelineEvent?.solarWindSpeed ?? spaceWeather.solarWindSpeed,
  bzComponent: timelineEvent?.bzComponent ?? spaceWeather.bzComponent,
  stormLevel: timelineEvent?.stormLevel ?? spaceWeather.stormLevel
});
