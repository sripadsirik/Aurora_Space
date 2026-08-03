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

/** A single plotted sparkline point: pixel coordinates plus the source value. */
export interface SparklinePoint {
  x: number;
  y: number;
  value: number;
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

/**
 * Places each value in a series onto evenly spaced `x` columns spanning the full
 * `width`, pairing every column with its {@link sparklineY} height. When `max`
 * is omitted it defaults to the largest value in the series, so a bare series
 * fills the vertical space. A single-element series is pinned to `x = 0`, and an
 * empty series yields no points.
 */
export const sparklinePoints = (values: readonly number[], options: SparklineOptions): SparklinePoint[] => {
  if (values.length === 0) return [];
  const { width, height, min = 0 } = options;
  const max = options.max ?? Math.max(...values);
  const lastIndex = values.length - 1;
  return values.map((value, index) => ({
    x: lastIndex === 0 ? 0 : (index / lastIndex) * width,
    y: sparklineY(value, { height, min, max }),
    value
  }));
};

/**
 * Builds an SVG `path` `d` string that connects the given points in order: the
 * first point becomes a `moveto` (`M`) and each subsequent point a `lineto`
 * (`L`). Returns an empty string for an empty point list.
 */
export const sparklinePath = (points: readonly SparklinePoint[]): string =>
  points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

/** A plotted sparkline: the per-value points plus the connecting SVG path. */
export interface Sparkline {
  points: SparklinePoint[];
  path: string;
}

/**
 * Convenience wrapper that plots a series into {@link SparklinePoint}s and the
 * matching {@link sparklinePath} string in one call, so a renderer can derive
 * both the marker positions and the connecting line from a single pass.
 */
export const buildSparkline = (values: readonly number[], options: SparklineOptions): Sparkline => {
  const points = sparklinePoints(values, options);
  return { points, path: sparklinePath(points) };
};

/**
 * Vertical pixel position of a horizontal reference line drawn at `threshold`,
 * using the same scale as the plotted series. Handy for overlaying alert bands
 * (for example a storm-level marker) on top of a sparkline. Thresholds outside
 * `[min, max]` are clamped to the drawing area by {@link sparklineY}.
 */
export const sparklineThresholdY = (threshold: number, options: SparklineOptions): number =>
  sparklineY(threshold, { height: options.height, min: options.min ?? 0, max: options.max });
