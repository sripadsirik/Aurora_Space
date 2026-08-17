import { describe, expect, it } from "vitest";
import { formatKpIndex, formatMagneticFieldNt } from "../measurements";

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
