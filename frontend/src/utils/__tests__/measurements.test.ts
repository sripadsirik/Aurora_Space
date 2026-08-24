import { describe, expect, it } from "vitest";
import {
  formatAltitudeKm,
  formatKpIndex,
  formatMagneticFieldNt,
  formatSpeedKms
} from "../measurements";

describe("formatKpIndex", () => {
  it("renders one decimal place", () => {
    expect(formatKpIndex(5.34)).toBe("5.3");
    expect(formatKpIndex(0)).toBe("0.0");
    expect(formatKpIndex(9)).toBe("9.0");
  });

  it("renders a non-finite value as an em dash", () => {
    expect(formatKpIndex(NaN)).toBe("—");
    expect(formatKpIndex(Infinity)).toBe("—");
  });
});

describe("formatMagneticFieldNt", () => {
  it("renders one decimal place with the nT unit", () => {
    expect(formatMagneticFieldNt(4.27)).toBe("4.3 nT");
    expect(formatMagneticFieldNt(0)).toBe("0.0 nT");
  });

  it("preserves a negative (southward) sign", () => {
    expect(formatMagneticFieldNt(-5.2)).toBe("-5.2 nT");
  });

  it("renders a non-finite value as an em dash", () => {
    expect(formatMagneticFieldNt(NaN)).toBe("—");
  });
});

describe("formatAltitudeKm", () => {
  it("renders one decimal place with the km unit", () => {
    expect(formatAltitudeKm(412.53)).toBe("412.5 km");
    expect(formatAltitudeKm(0)).toBe("0.0 km");
  });

  it("renders a non-finite value as an em dash", () => {
    expect(formatAltitudeKm(NaN)).toBe("—");
  });
});

describe("formatSpeedKms", () => {
  it("defaults to one fraction digit", () => {
    expect(formatSpeedKms(7.65)).toBe("7.7 km/s");
  });

  it("honours a custom fraction-digit count", () => {
    expect(formatSpeedKms(7.123, 3)).toBe("7.123 km/s");
    expect(formatSpeedKms(11.5, 2)).toBe("11.50 km/s");
  });

  it("renders a non-finite value as an em dash", () => {
    expect(formatSpeedKms(NaN)).toBe("—");
  });
});
