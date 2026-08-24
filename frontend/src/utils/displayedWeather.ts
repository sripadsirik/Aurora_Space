import type { HistoricalEvent, SpaceWeather } from "../types/space";

/** The subset of space-weather fields a timeline event is allowed to override. */
export type TimelineWeatherOverride = Pick<
  HistoricalEvent,
  "kpIndex" | "solarWindSpeed" | "bzComponent" | "stormLevel"
>;

/** Space-weather values resolved for display, after any timeline override. */
export interface DisplayedWeather {
  kpIndex: number;
  solarWindSpeed: number;
  bzComponent: number;
  stormLevel: SpaceWeather["stormLevel"];
}

/**
 * Resolves the space-weather values to display, letting an optional timeline
 * event override the live feed field by field. When the timeline is not
 * scrubbed to an event (`null`/`undefined`) — or an event omits a given field —
 * the live feed value is used. Centralises the `timelineEvent?.x ?? feed.x`
 * pattern that the HUD, storm panel, and storm overlay each repeated so they can
 * never drift apart.
 */
export const resolveDisplayedWeather = (
  spaceWeather: SpaceWeather,
  timelineEvent?: TimelineWeatherOverride | null
): DisplayedWeather => ({
  kpIndex: timelineEvent?.kpIndex ?? spaceWeather.kpIndex,
  solarWindSpeed: timelineEvent?.solarWindSpeed ?? spaceWeather.solarWindSpeed,
  bzComponent: timelineEvent?.bzComponent ?? spaceWeather.bzComponent,
  stormLevel: timelineEvent?.stormLevel ?? spaceWeather.stormLevel
});
