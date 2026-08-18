import { describe, expect, it } from "vitest";
import { ELEVATED_SOLAR_WIND_KMS, isElevatedSolarWind } from "../solarWind";

describe("isElevatedSolarWind", () => {
  it("is false for a calm stream below the threshold", () => {
    expect(isElevatedSolarWind(380)).toBe(false);
  });

  it("is true well above the threshold", () => {
    expect(isElevatedSolarWind(620)).toBe(true);
  });

  it("treats the threshold speed itself as elevated", () => {
    expect(isElevatedSolarWind(ELEVATED_SOLAR_WIND_KMS)).toBe(true);
  });

  it("is false just below the threshold", () => {
    expect(isElevatedSolarWind(ELEVATED_SOLAR_WIND_KMS - 1)).toBe(false);
  });
});
