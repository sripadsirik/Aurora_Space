/**
 * Small numeric clamping helpers shared across the UI. Several panels and
 * scales independently constrained values to a range with nested
 * `Math.max`/`Math.min` calls; centralising the idiom keeps the intent legible
 * and gives it a single tested definition.
 */

/**
 * Constrains `value` to the inclusive `[min, max]` range. When `min` is greater
 * than `max` the bounds are treated as reversed, so the result still lands
 * inside the interval they describe.
 */
export const clamp = (value: number, min: number, max: number): number => {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.max(lower, Math.min(upper, value));
};

/**
 * Constrains `value` to the unit interval `[0, 1]`, the common case for a
 * normalised fraction feeding a progress bar, opacity, or scale position.
 */
export const clamp01 = (value: number): number => clamp(value, 0, 1);
