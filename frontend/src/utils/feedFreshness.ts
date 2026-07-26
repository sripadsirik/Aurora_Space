/** Data-freshness classification for a feed's last-updated timestamp. */
export type FreshnessStatus = "live" | "stale" | "error";

export interface FeedFreshness {
  /** Human-readable age label, for example `12s ago` or `4m ago`. */
  label: string;
  status: FreshnessStatus;
}

/**
 * Classifies how fresh a feed is from its last-updated timestamp relative to
 * `now`. Feeds under five minutes old are `live`, five to fifteen minutes are
 * `stale`, and anything older (or missing/invalid) is `error`. The label reads
 * in seconds while under a minute old, otherwise in whole minutes.
 */
export const describeFeedFreshness = (lastUpdated: Date | null, now: Date): FeedFreshness => {
  try {
    if (!lastUpdated) return { label: "NO DATA", status: "error" };
    const updated = lastUpdated instanceof Date ? lastUpdated : new Date(lastUpdated as unknown as string);
    if (isNaN(updated.getTime())) return { label: "unknown", status: "error" };
    const ageMs = now.getTime() - updated.getTime();
    const ageMinutes = ageMs / 60_000;
    if (ageMinutes > 15) return { label: `${Math.round(ageMinutes)}m ago`, status: "error" };
    if (ageMinutes > 5) return { label: `${Math.round(ageMinutes)}m ago`, status: "stale" };
    if (ageMs < 60_000) return { label: `${Math.round(ageMs / 1000)}s ago`, status: "live" };
    return { label: `${Math.round(ageMinutes)}m ago`, status: "live" };
  } catch {
    return { label: "unknown", status: "error" };
  }
};
