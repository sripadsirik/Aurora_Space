import { expect, it } from "vitest";
import {
  Axis,
  Cartesian3,
  Matrix3,
  Matrix4,
  Quaternion,
  Transforms,
} from "cesium";
import { aircraftAttitude, aircraftCourseVector } from "./aircraftAttitude";
it("aligns the actual glTF nose with the track at cardinal and oblique headings", () => {
  // Cesium exports these runtime matrices but omits them from the Axis enum types.
  const axes = Axis as unknown as {
    Y_UP_TO_Z_UP: Matrix4;
    Z_UP_TO_X_UP: Matrix4;
  };
  const correction = Matrix4.multiply(
    axes.Y_UP_TO_Z_UP,
    axes.Z_UP_TO_X_UP,
    new Matrix4(),
  );
  const nose = Matrix4.multiplyByPointAsVector(
    correction,
    new Cartesian3(0, 0, -1),
    new Cartesian3(),
  );
  for (const [lat, lon] of [
    [0, 0],
    [28, -80],
    [-33, 151],
  ])
    for (const degrees of [0, 45, 90, 180, 270, 359]) {
      const p = Cartesian3.fromDegrees(lon, lat, 10000),
        r = (degrees * Math.PI) / 180;
      const actual = Matrix3.multiplyByVector(
        Matrix3.fromQuaternion(aircraftAttitude(p, r)),
        nose,
        new Cartesian3(),
      );
      const expected = Matrix4.multiplyByPointAsVector(
        Transforms.eastNorthUpToFixedFrame(p),
        new Cartesian3(Math.sin(r), Math.cos(r), 0),
        new Cartesian3(),
      );
      expect(Cartesian3.dot(actual, expected)).toBeCloseTo(1, 10);
      expect(Cartesian3.dot(aircraftCourseVector(p, r), expected)).toBeCloseTo(
        1,
        10,
      );
    }
});
