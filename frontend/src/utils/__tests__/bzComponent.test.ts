import { describe, expect, it } from "vitest";
import { bzMagnetosphereLabel, isBzSouthward } from "../bzComponent";

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

describe("bzMagnetosphereLabel", () => {
  it("reads as weakened for a southward field", () => {
    expect(bzMagnetosphereLabel(-6.5)).toBe("SHIELD WEAKENED");
  });

  it("reads as closed for a northward field", () => {
    expect(bzMagnetosphereLabel(2.0)).toBe("SHIELD CLOSED");
  });

  it("reads as closed at exactly zero", () => {
    expect(bzMagnetosphereLabel(0)).toBe("SHIELD CLOSED");
  });
});
