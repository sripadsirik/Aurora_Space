import { describe, expect, it } from "vitest";
import { formatKpIndex } from "../measurements";

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
