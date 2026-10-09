import { describe, expect, it } from "vitest";
import { mockConjunctions } from "../../data/mock/conjunctions";
import { mockSatellites } from "../../data/mock/satellites";
import { mockSpaceWeather } from "../../data/mock/spaceWeather";
import { parseFeedMessage } from "../parseFeedMessage";

describe("parseFeedMessage", () => {
  it("accepts valid backend shapes and restores date fields", () => {
    expect(parseFeedMessage({ type: "satellites", payload: mockSatellites.slice(0, 1) })?.type).toBe("satellites");
    const conjunction = parseFeedMessage({
      type: "conjunctions",
      payload: [{ ...mockConjunctions[0], tca: mockConjunctions[0].tca.toISOString() }]
    });
    expect(conjunction?.type).toBe("conjunctions");
    if (conjunction?.type === "conjunctions") expect(conjunction.payload[0].tca).toBeInstanceOf(Date);

    const weather = parseFeedMessage({
      type: "spaceWeather",
      payload: { ...mockSpaceWeather, lastUpdated: mockSpaceWeather.lastUpdated.toISOString() }
    });
    expect(weather?.type).toBe("spaceWeather");
    if (weather?.type === "spaceWeather") expect(weather.payload.lastUpdated).toBeInstanceOf(Date);
  });

  it("rejects malformed payloads instead of treating them as fresh data", () => {
    expect(parseFeedMessage({ type: "satellites", payload: null })).toBeNull();
    expect(parseFeedMessage({ type: "satellites", payload: [{ ...mockSatellites[0], lat: "north" }] })).toBeNull();
    expect(parseFeedMessage({ type: "conjunctions", payload: [{ ...mockConjunctions[0], tca: "invalid" }] })).toBeNull();
    expect(parseFeedMessage({ type: "spaceWeather", payload: { ...mockSpaceWeather, lastUpdated: "invalid" } })).toBeNull();
    expect(parseFeedMessage({ type: "connected", payload: {} })).toBeNull();
  });
});
