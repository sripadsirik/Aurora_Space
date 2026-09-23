import { describe, expect, it } from "vitest";
import { formatElectricFieldMvM } from "../format";
describe("formatElectricFieldMvM", () => {
  it("renders a coupling field with two fraction digits and a mV/m suffix", () => {
    expect(formatElectricFieldMvM(5.58)).toBe("5.58 mV/m");
  });

  it("rounds to two fraction digits", () => {
    expect(formatElectricFieldMvM(3.126)).toBe("3.13 mV/m");
  });

  it("renders a plain zero field rather than an em dash", () => {
    expect(formatElectricFieldMvM(0)).toBe("0.00 mV/m");
  });

  it("renders an em dash for negative or non-finite inputs", () => {
    expect(formatElectricFieldMvM(-1)).toBe("—");
    expect(formatElectricFieldMvM(Number.NaN)).toBe("—");
  });
});
