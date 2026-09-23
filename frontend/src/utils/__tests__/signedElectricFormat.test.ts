import { describe, it, expect } from "vitest";
import { formatSignedElectricField } from "../format";
describe("formatSignedElectricField", () => {
  it("renders a field with two fraction digits and a mV/m suffix", () => {
    expect(formatSignedElectricField(1.6)).toBe("1.60 mV/m");
  });

  it("keeps the sign for a northward (negative) field", () => {
    expect(formatSignedElectricField(-0.8)).toBe("-0.80 mV/m");
  });

  it("renders an em dash for non-finite inputs", () => {
    expect(formatSignedElectricField(Number.NaN)).toBe("—");
    expect(formatSignedElectricField(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
