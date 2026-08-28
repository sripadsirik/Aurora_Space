import { describe, expect, it } from "vitest";
import { hemisphereForLatitude } from "../auroraViewingDirection";

describe("hemisphereForLatitude", () => {
  it("maps a positive latitude to the northern hemisphere", () => {
    expect(hemisphereForLatitude(51.5)).toBe("northern");
  });

  it("maps a negative latitude to the southern hemisphere", () => {
    expect(hemisphereForLatitude(-33.9)).toBe("southern");
  });

  it("returns null exactly on the equator", () => {
    expect(hemisphereForLatitude(0)).toBeNull();
  });

  it("returns null for non-finite latitudes", () => {
    expect(hemisphereForLatitude(Number.NaN)).toBeNull();
    expect(hemisphereForLatitude(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
