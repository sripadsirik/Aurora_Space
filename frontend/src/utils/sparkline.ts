/** Options controlling how a value series maps onto sparkline pixel coordinates. */
export interface SparklineOptions {
  /** Width of the drawing area in pixels. */
  width: number;
  /** Height of the drawing area in pixels. */
  height: number;
  /**
   * Value mapped to the bottom edge (`y = height`). Defaults to `0`. Values below
   * `min` are clamped to the bottom edge.
   */
  min?: number;
  /**
   * Value mapped to the top edge (`y = 0`). Defaults to the largest value in the
   * series. Values above `max` are clamped to the top edge.
   */
  max?: number;
}

/**
 * Maps a single value onto its vertical pixel position within a sparkline of the
 * given `height`. The SVG y-axis grows downward, so the smallest value sits at
 * `y = height` (bottom) and the largest at `y = 0` (top). Values outside the
 * `[min, max]` range are clamped to the nearest edge, and a zero-width value
 * range collapses to the bottom edge so the result is always finite.
 */
export const sparklineY = (
  value: number,
  { height, min = 0, max }: Pick<SparklineOptions, "height" | "min" | "max">
): number => {
  const top = max ?? min;
  const range = top - min;
  if (range <= 0) return height;
  const fraction = Math.min(1, Math.max(0, (value - min) / range));
  return height - fraction * height;
};
