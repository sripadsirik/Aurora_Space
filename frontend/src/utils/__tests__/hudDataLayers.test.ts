import { describe, expect, it } from "vitest";
import type { FeedFreshness } from "../feedFreshness";
import { buildHudDataLayers } from "../hudDataLayers";

const fresh = (label: string, status: FeedFreshness["status"]): FeedFreshness => ({ label, status });

const inputs = {
  satelliteCount: 128,
  satelliteFreshness: fresh("8s ago", "live"),
  conjunctionCount: 4,
  conjunctionFreshness: fresh("6m ago", "stale"),
  weatherFreshness: fresh("20m ago", "error")
};

describe("buildHudDataLayers", () => {
  it("produces the four expected layers in order", () => {
    const rows = buildHudDataLayers(inputs);
    expect(rows.map((r) => r.name)).toEqual([
      "Satellites",
      "Conjunctions",
      "Space Weather",
      "Aurora Forecast"
    ]);
  });

  it("maps each layer to its upstream source label", () => {
    const rows = buildHudDataLayers(inputs);
    expect(rows.map((r) => r.source)).toEqual([
      "CelesTrak",
      "Space-Track",
      "NOAA SWPC",
      "NOAA Ovation"
    ]);
  });

  it("carries the live counts and freshness through to the rows", () => {
    const rows = buildHudDataLayers(inputs);
    expect(rows[0]).toMatchObject({ count: 128, freshness: "8s ago", status: "live" });
    expect(rows[1]).toMatchObject({ count: 4, freshness: "6m ago", status: "stale" });
  });

  it("drives both weather rows from the weather feed freshness", () => {
    const rows = buildHudDataLayers(inputs);
    expect(rows[2]).toMatchObject({ count: 1, freshness: "20m ago", status: "error" });
    expect(rows[3]).toMatchObject({ count: 2, freshness: "20m ago", status: "error" });
  });
});
