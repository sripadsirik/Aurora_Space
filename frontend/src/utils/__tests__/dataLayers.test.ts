import { describe, expect, it } from "vitest";

import { buildDataLayerRows } from "../dataLayers";

const now = new Date("2026-08-23T12:00:00Z");

describe("buildDataLayerRows", () => {
  it("returns the four fixed layers in order", () => {
    const rows = buildDataLayerRows(
      { satellites: 0, conjunctions: 0 },
      { satellites: null, conjunctions: null, spaceWeather: null },
      now
    );
    expect(rows.map((r) => r.name)).toEqual([
      "Satellites",
      "Conjunctions",
      "Space Weather",
      "Aurora Forecast"
    ]);
  });

  it("sizes the satellite and conjunction rows from the live counts", () => {
    const rows = buildDataLayerRows(
      { satellites: 42, conjunctions: 7 },
      { satellites: now, conjunctions: now, spaceWeather: now },
      now
    );
    expect(rows[0].count).toBe(42);
    expect(rows[1].count).toBe(7);
  });

  it("uses fixed counts for the weather and aurora rows", () => {
    const rows = buildDataLayerRows(
      { satellites: 5, conjunctions: 5 },
      { satellites: now, conjunctions: now, spaceWeather: now },
      now
    );
    expect(rows[2].count).toBe(1);
    expect(rows[3].count).toBe(2);
  });

  it("shares the space-weather freshness between the weather and aurora rows", () => {
    const stale = new Date("2026-08-23T11:52:00Z");
    const rows = buildDataLayerRows(
      { satellites: 1, conjunctions: 1 },
      { satellites: now, conjunctions: now, spaceWeather: stale },
      now
    );
    expect(rows[2].status).toBe("stale");
    expect(rows[3].status).toBe("stale");
    expect(rows[3].freshness).toBe(rows[2].freshness);
  });

  it("classifies a missing feed timestamp as an error row", () => {
    const rows = buildDataLayerRows(
      { satellites: 3, conjunctions: 3 },
      { satellites: null, conjunctions: now, spaceWeather: now },
      now
    );
    expect(rows[0].status).toBe("error");
    expect(rows[0].freshness).toBe("NO DATA");
  });
});
