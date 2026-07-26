import { describe, expect, it } from "vitest";
import type { Satellite } from "../../types/space";
import { getSpaceWeatherImpact } from "../satelliteImpact";

const makeSatellite = (orbitType: Satellite["orbitType"]): Satellite => ({
  noradId: 1,
  name: "TEST",
  lat: 0,
  lon: 0,
  altitudeKm: 500,
  velocityKms: 7.6,
  orbitType,
  riskLevel: "nominal",
  owner: "TEST",
  conjunctionCount: 0
});

describe("getSpaceWeatherImpact", () => {
  it("escalates LEO drag risk with the Kp index", () => {
    const leo = makeSatellite("LEO");
    expect(getSpaceWeatherImpact(leo, 3).label).toBe("LOW");
    expect(getSpaceWeatherImpact(leo, 5).label).toBe("MEDIUM");
    expect(getSpaceWeatherImpact(leo, 6).label).toBe("HIGH");
  });

  it("escalates GEO charging risk with the Kp index", () => {
    const geo = makeSatellite("GEO");
    expect(getSpaceWeatherImpact(geo, 4).label).toBe("LOW");
    expect(getSpaceWeatherImpact(geo, 5).label).toBe("MEDIUM");
    expect(getSpaceWeatherImpact(geo, 7).label).toBe("HIGH");
  });

  it("escalates MEO radiation risk with the Kp index", () => {
    const meo = makeSatellite("MEO");
    expect(getSpaceWeatherImpact(meo, 3).label).toBe("LOW");
    expect(getSpaceWeatherImpact(meo, 5).label).toBe("MEDIUM");
    expect(getSpaceWeatherImpact(meo, 7).label).toBe("HIGH");
  });

  it("describes the dominant effect per orbit regime", () => {
    expect(getSpaceWeatherImpact(makeSatellite("LEO"), 6).description).toMatch(/drag/i);
    expect(getSpaceWeatherImpact(makeSatellite("GEO"), 7).description).toMatch(/charging/i);
    expect(getSpaceWeatherImpact(makeSatellite("MEO"), 7).description).toMatch(/radiation/i);
  });
});
