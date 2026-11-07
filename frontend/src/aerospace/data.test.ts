import { describe, expect, it } from "vitest";
import { countdown, parseAircraft, parseLaunches } from "./data";
describe("aerospace feed boundaries", () => {
  it("rejects old or unlocated positions and preserves observed times and units", () => {
    const base = {
      hex: "abc",
      lat: 28,
      lon: -80,
      alt_geom: 10000,
      seen_pos: 3,
      dbFlags: 1,
    };
    const rows = parseAircraft({
      now: 100000,
      ac: [
        base,
        { ...base, seen_pos: 61 },
        { ...base, lat: 91 },
        { ...base, alt_geom: null },
        { ...base, lat: null },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      altitudeM: 3048,
      military: true,
      observedAt: 97000,
    });
  });
  it("does not infer liftoff or count through a hold", () => {
    expect(
      countdown("2026-01-01", Date.parse("2026-01-02"), "Go for Launch"),
    ).toContain("awaiting status");
    expect(countdown("2026-01-03", 0, "On Hold")).toBe("On Hold");
    expect(countdown("2026-11-30", 0, "To Be Determined")).toBe(
      "To Be Determined",
    );
    expect(countdown("invalid", 0, "Go")).toBe("Time unconfirmed");
    expect(countdown("1970-01-02T01:01:01Z", 0, "Go")).toBe("T− 1d 01:01:01");
  });
  it("preserves unknown pad coordinates and rejects unsafe webcast URLs", () => {
    const [l] = parseLaunches({
      results: [
        {
          id: "1",
          name: "Rocket",
          vid_urls: [{ url: "javascript:alert(1)" }],
          pad: { latitude: null, longitude: 300 },
        },
      ],
    });
    expect(l.lat).toBeNull();
    expect(l.lon).toBeNull();
    expect(l.webcast).toBeNull();
  });
  it("fails malformed envelopes instead of replacing a feed with fabricated data", () => {
    expect(() => parseAircraft({})).toThrow();
    expect(() => parseLaunches({})).toThrow();
  });
});
