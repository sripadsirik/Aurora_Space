import { describe, expect, it } from "vitest";
import { isBzSouthward } from "../bzComponent";

describe("isBzSouthward", () => {
  it("is true for a negative (southward) Bz reading", () => {
    expect(isBzSouthward(-4.2)).toBe(true);
  });

  it("is false for a positive (northward) Bz reading", () => {
    expect(isBzSouthward(3.1)).toBe(false);
  });

  it("treats zero as not southward", () => {
    expect(isBzSouthward(0)).toBe(false);
  });

  it("treats a non-finite reading as not southward", () => {
    expect(isBzSouthward(Number.NaN)).toBe(false);
  });
});
