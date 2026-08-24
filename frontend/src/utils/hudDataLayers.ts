import type { FeedFreshness, FreshnessStatus } from "./feedFreshness";

/** A single row in the HUD's "Data Layers" panel. */
export interface HudDataLayerRow {
  /** Layer name shown to the operator. */
  name: string;
  /** Upstream data source label. */
  source: string;
  /** Human-readable freshness label (for example `12s ago`). */
  freshness: string;
  /** Count badge shown at the end of the row. */
  count: number;
  /** Freshness classification driving the row's status dot. */
  status: FreshnessStatus;
}

/** Live counts and per-feed freshness feeding the HUD data-layer rows. */
export interface HudDataLayerInputs {
  satelliteCount: number;
  satelliteFreshness: FeedFreshness;
  conjunctionCount: number;
  conjunctionFreshness: FeedFreshness;
  /** Space-weather and aurora-forecast rows both track the weather feed. */
  weatherFreshness: FeedFreshness;
}

/** Number of derived products the aurora-forecast layer bundles (Kp + Ovation). */
const AURORA_FORECAST_PRODUCTS = 2;

/**
 * Assembles the four HUD data-layer rows (satellites, conjunctions, space
 * weather, aurora forecast) from the live feed counts and freshness. The space
 * weather and aurora forecast rows share the weather feed's freshness. Extracted
 * from the HUD component so the source labels and row assembly have a single
 * tested definition instead of an inline literal.
 */
export const buildHudDataLayers = (inputs: HudDataLayerInputs): HudDataLayerRow[] => [
  {
    name: "Satellites",
    source: "CelesTrak",
    freshness: inputs.satelliteFreshness.label,
    count: inputs.satelliteCount,
    status: inputs.satelliteFreshness.status
  },
  {
    name: "Conjunctions",
    source: "Space-Track",
    freshness: inputs.conjunctionFreshness.label,
    count: inputs.conjunctionCount,
    status: inputs.conjunctionFreshness.status
  },
  {
    name: "Space Weather",
    source: "NOAA SWPC",
    freshness: inputs.weatherFreshness.label,
    count: 1,
    status: inputs.weatherFreshness.status
  },
  {
    name: "Aurora Forecast",
    source: "NOAA Ovation",
    freshness: inputs.weatherFreshness.label,
    count: AURORA_FORECAST_PRODUCTS,
    status: inputs.weatherFreshness.status
  }
];
