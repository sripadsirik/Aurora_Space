import { describe, expect, it } from "vitest";
import {
  hemisphereForLatitude,
  polewardBearingDegrees,
  polewardCompassPoint
} from "../auroraViewingDirection";

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

describe("polewardCompassPoint", () => {
  it("faces north from the northern hemisphere", () => {
    expect(polewardCompassPoint("northern")).toBe("N");
  });

  it("faces south from the southern hemisphere", () => {
    expect(polewardCompassPoint("southern")).toBe("S");
  });
});

describe("polewardBearingDegrees", () => {
  it("is 0 degrees (true north) from the northern hemisphere", () => {
    expect(polewardBearingDegrees("northern")).toBe(0);
  });

  it("is 180 degrees (true south) from the southern hemisphere", () => {
    expect(polewardBearingDegrees("southern")).toBe(180);
  });
});
