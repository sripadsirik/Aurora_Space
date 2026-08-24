import { describe, expect, it } from "vitest";
import { describeFeedFreshness, freshnessStatusDotClass } from "../feedFreshness";

const now = new Date("2026-07-26T12:00:00Z");
const agoMs = (ms: number): Date => new Date(now.getTime() - ms);

describe("describeFeedFreshness", () => {
  it("reports an error with no label data when the timestamp is missing", () => {
    expect(describeFeedFreshness(null, now)).toEqual({ label: "NO DATA", status: "error" });
  });

  it("reports an error for an invalid timestamp", () => {
    expect(describeFeedFreshness(new Date("not a date"), now)).toEqual({ label: "unknown", status: "error" });
  });

  it("labels sub-minute ages in seconds and stays live", () => {
    expect(describeFeedFreshness(agoMs(12_000), now)).toEqual({ label: "12s ago", status: "live" });
  });

  it("labels a few-minute age in minutes and stays live", () => {
    expect(describeFeedFreshness(agoMs(3 * 60_000), now)).toEqual({ label: "3m ago", status: "live" });
  });

  it("marks feeds older than five minutes as stale", () => {
    expect(describeFeedFreshness(agoMs(10 * 60_000), now)).toEqual({ label: "10m ago", status: "stale" });
  });

  it("marks feeds older than fifteen minutes as error", () => {
    expect(describeFeedFreshness(agoMs(20 * 60_000), now)).toEqual({ label: "20m ago", status: "error" });
  });

  it("treats the sixty-second boundary as a minute-scale live label", () => {
    expect(describeFeedFreshness(agoMs(60_000), now)).toEqual({ label: "1m ago", status: "live" });
  });

  it("falls back to an error when a timestamp throws while being read", () => {
    const exploding = {
      getTime: () => {
        throw new Error("boom");
      }
    } as unknown as Date;
    expect(describeFeedFreshness(agoMs(1000), exploding)).toEqual({ label: "unknown", status: "error" });
  });
});

describe("freshnessStatusDotClass", () => {
  it("maps a live feed to green by default", () => {
    expect(freshnessStatusDotClass("live")).toBe("bg-[#00ff88]");
  });

  it("switches the live dot to orange in intel mode", () => {
    expect(freshnessStatusDotClass("live", { intel: true })).toBe("bg-[#ff6600]");
  });

  it("keeps a stale feed amber regardless of mode", () => {
    expect(freshnessStatusDotClass("stale")).toBe("bg-[#ffcc00]");
    expect(freshnessStatusDotClass("stale", { intel: true })).toBe("bg-[#ffcc00]");
  });

  it("keeps an error feed red regardless of mode", () => {
    expect(freshnessStatusDotClass("error")).toBe("bg-[#ff4444]");
    expect(freshnessStatusDotClass("error", { intel: true })).toBe("bg-[#ff4444]");
  });
});
