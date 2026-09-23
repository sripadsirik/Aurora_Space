import { describe, expect, it } from "vitest";
import { formatMergingField } from "../format";
describe("formatMergingField", () => {
  it("renders a field with two fraction digits and a mV/m suffix", () => {
    expect(formatMergingField(2)).toBe("2.00 mV/m");
    expect(formatMergingField(6.128)).toBe("6.13 mV/m");
  });

  it("renders an em dash for negative or non-finite inputs", () => {
    expect(formatMergingField(-1)).toBe("—");
    expect(formatMergingField(Number.NaN)).toBe("—");
    expect(formatMergingField(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
