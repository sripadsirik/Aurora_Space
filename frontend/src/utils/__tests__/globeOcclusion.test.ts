import { expect, it } from "vitest";
import { Cartesian3, Ellipsoid } from "cesium";
import { GlobeOcclusion } from "../globeOcclusion";

it("hides far-side satellites and keeps near-side satellites visible", () => {
  const visibility = new GlobeOcclusion(Ellipsoid.WGS84, Cartesian3.fromDegrees(0, 0, 1_000));
  expect(visibility.isPointVisible(Cartesian3.fromDegrees(180, 0, 400_000))).toBe(false);
  expect(visibility.isPointVisible(Cartesian3.fromDegrees(0, 0, 400_000))).toBe(true);
  expect(visibility.isPointVisible(Cartesian3.fromDegrees(0, 0, -1_000))).toBe(false);
});

it("keeps satellites above the horizon and updates when the camera moves", () => {
  const visibility = new GlobeOcclusion(Ellipsoid.WGS84, Cartesian3.fromDegrees(0, 0, 1_000));
  const satellite = Cartesian3.fromDegrees(10, 0, 400_000);
  expect(visibility.isPointVisible(satellite)).toBe(true);
  visibility.cameraPosition = Cartesian3.fromDegrees(180, 0, 1_000);
  expect(visibility.isPointVisible(satellite)).toBe(false);
});

it("handles polar views and does not hide objects before an Earth intersection", () => {
  const visibility = new GlobeOcclusion(Ellipsoid.WGS84, Cartesian3.fromDegrees(0, 90, 2_000_000));
  expect(visibility.isPointVisible(Cartesian3.fromDegrees(0, 90, 400_000))).toBe(true);
  expect(visibility.isPointVisible(Cartesian3.fromDegrees(0, -90, 400_000))).toBe(false);
});
