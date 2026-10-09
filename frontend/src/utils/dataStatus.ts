import type { FeedKey } from "../store/auroraStore";
import { describeFeedFreshness } from "./feedFreshness";

export type DataStatus = "demo" | "mixed" | "live" | "stale" | "offline";

/** Describes the data actually on screen, not just the WebSocket connection. */
export const getDataStatus = (
  connected: boolean,
  lastUpdated: Record<FeedKey, Date | null>,
  now: Date
): { status: DataStatus; label: string; detail: string } => {
  const feeds = Object.values(lastUpdated);
  const received = feeds.filter((date) => date !== null).length;

  if (received === 0) {
    return { status: "demo", label: "DEMO DATA", detail: "Showing sample data while live feeds are unavailable." };
  }
  if (!connected) {
    return { status: "offline", label: "CONNECTION LOST", detail: "Showing the last received feeds alongside sample data." };
  }
  if (received < feeds.length) {
    return { status: "mixed", label: "MIXED DATA", detail: `${received} of ${feeds.length} live feeds received; other layers use samples.` };
  }
  if (feeds.some((date) => describeFeedFreshness(date, now).status !== "live")) {
    return { status: "stale", label: "STALE DATA", detail: "One or more live feeds have not updated recently." };
  }
  return { status: "live", label: "LIVE DATA", detail: "All three data feeds are current." };
};
