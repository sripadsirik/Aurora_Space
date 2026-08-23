import { describeFeedFreshness } from "./feedFreshness";
import type { FreshnessStatus } from "./feedFreshness";

/** A single row in the HUD's "data layers" panel. */
export interface DataLayerRow {
  /** Display name of the layer, for example `Satellites`. */
  name: string;
  /** Upstream data source credited for the layer. */
  source: string;
  /** Human-readable freshness label derived from the feed timestamp. */
  freshness: string;
  /** Number of records currently rendered for the layer. */
  count: number;
  /** Freshness classification driving the status dot colour. */
  status: FreshnessStatus;
}

/** Last-updated timestamps for each backing feed, or `null` when never seen. */
export interface FeedTimestamps {
  satellites: Date | null;
  conjunctions: Date | null;
  spaceWeather: Date | null;
}

interface DataLayerCounts {
  satellites: number;
  conjunctions: number;
}

/**
 * Builds the rows shown in the HUD's data-layers panel. Satellite and
 * conjunction rows are sized from live counts, while the space-weather and
 * aurora-forecast rows share the space-weather feed's freshness and use fixed
 * counts (one weather record, two aurora hemispheres).
 */
export const buildDataLayerRows = (
  counts: DataLayerCounts,
  feedLastUpdated: FeedTimestamps,
  now: Date
): DataLayerRow[] => {
  const satFresh = describeFeedFreshness(feedLastUpdated.satellites, now);
  const conjFresh = describeFeedFreshness(feedLastUpdated.conjunctions, now);
  const wxFresh = describeFeedFreshness(feedLastUpdated.spaceWeather, now);

  return [
    {
      name: "Satellites",
      source: "CelesTrak",
      freshness: satFresh.label,
      count: counts.satellites,
      status: satFresh.status
    },
    {
      name: "Conjunctions",
      source: "Space-Track",
      freshness: conjFresh.label,
      count: counts.conjunctions,
      status: conjFresh.status
    },
    {
      name: "Space Weather",
      source: "NOAA SWPC",
      freshness: wxFresh.label,
      count: 1,
      status: wxFresh.status
    },
    {
      name: "Aurora Forecast",
      source: "NOAA Ovation",
      freshness: wxFresh.label,
      count: 2,
      status: wxFresh.status
    }
  ];
};
