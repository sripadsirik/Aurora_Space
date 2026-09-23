import { describe, it, expect } from "vitest";
import { formatGeoeffectiveField } from "../format";
describe("formatGeoeffectiveField", () => {
  it("renders a field with two fraction digits and a mV/m suffix", () => {
    expect(formatGeoeffectiveField(3.2)).toBe("3.20 mV/m");
  });

  it("rounds to two fraction digits", () => {
    expect(formatGeoeffectiveField(5.678)).toBe("5.68 mV/m");
  });

  it("renders a zero (uncoupled) field", () => {
    expect(formatGeoeffectiveField(0)).toBe("0.00 mV/m");
  });

  it("renders an em dash for negative or non-finite inputs", () => {
    expect(formatGeoeffectiveField(-1)).toBe("—");
    expect(formatGeoeffectiveField(Number.NaN)).toBe("—");
    expect(formatGeoeffectiveField(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
