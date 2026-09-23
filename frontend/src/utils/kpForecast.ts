/**
 * Synthetic short-term Kp forecast for the space-weather panel.
 *
 * The live feed only carries the current planetary K-index, but the panel shows
 * a small "next 24 hours" trend strip. That trend is a deterministic wobble
 * around the current value — enough to read as a forecast without pretending to
 * be a real model. The generator lived inline in a `useMemo`; pulling it out
 * keeps the shape and bounds in one testable place.
 */

/** Number of forecast samples, one every {@link KP_FORECAST_STEP_HOURS}. */
export const KP_FORECAST_POINTS = 8;

/** Spacing between forecast samples, in hours (8 points ⇒ a 21-hour horizon). */
export const KP_FORECAST_STEP_HOURS = 3;

/** Lowest representable planetary K-index. */
export const KP_MIN = 0;

/** Highest representable planetary K-index. */
export const KP_MAX = 9;

/** A single forecast sample: a Kp value at a given number of hours ahead. */
export interface KpForecastPoint {
  hoursAhead: number;
  kp: number;
}

/**
 * Builds the synthetic Kp forecast strip around `currentKp`.
 *
 * Each point wobbles the current index by a fixed sinusoid so the curve is
 * stable for a given input, then clamps to the valid `0-9` Kp range and rounds
 * to one decimal. The wobble depends only on the sample index, so the same
 * `currentKp` always yields the same strip.
 */
export const buildKpForecast = (currentKp: number): KpForecastPoint[] =>
  Array.from({ length: KP_FORECAST_POINTS }, (_, index) => {
    const hoursAhead = index * KP_FORECAST_STEP_HOURS;
    const wave = Math.sin(index * 0.9) * 0.8 + Math.cos(index * 0.35) * 0.4;
    const kp = Math.max(KP_MIN, Math.min(KP_MAX, Number((currentKp + wave).toFixed(1))));
    return { hoursAhead, kp };
  });
