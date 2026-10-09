import { describe, expect, it } from "vitest";
import { getDataStatus } from "../dataStatus";

const now = new Date("2026-10-09T12:00:00Z");
const recent = new Date(now.getTime() - 10_000);
const empty = { satellites: null, conjunctions: null, spaceWeather: null };

describe("getDataStatus", () => {
  it("labels initial sample content as demo data even when the socket connects", () => {
    expect(getDataStatus(false, empty, now).status).toBe("demo");
    expect(getDataStatus(true, empty, now).status).toBe("demo");
  });

  it("labels partial feed replacement as mixed data", () => {
    expect(getDataStatus(true, { ...empty, satellites: recent }, now)).toMatchObject({
      status: "mixed",
      label: "MIXED DATA"
    });
  });

  it("requires three recent feeds before calling the dashboard live", () => {
    const feeds = { satellites: recent, conjunctions: recent, spaceWeather: recent };
    expect(getDataStatus(true, feeds, now).status).toBe("live");
    expect(getDataStatus(false, feeds, now).status).toBe("offline");
    expect(getDataStatus(true, { ...feeds, conjunctions: new Date(now.getTime() - 7 * 60_000) }, now).status).toBe("stale");
  });
});
