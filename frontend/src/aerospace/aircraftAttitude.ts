import {
  HeadingPitchRoll,
  Math as CesiumMath,
  Transforms,
  Cartesian3,
  Matrix4,
} from "cesium";
/** Our glTF nose (-Z) becomes -X after Cesium's glTF axis correction. */
export function aircraftAttitude(position: Cartesian3, trackRadians: number) {
  return Transforms.headingPitchRollQuaternion(
    position,
    new HeadingPitchRoll(trackRadians + CesiumMath.PI_OVER_TWO, 0, 0),
  );
}

/** Project this world-space course into the billboard plane at any camera angle. */
export function aircraftCourseVector(
  position: Cartesian3,
  trackRadians: number,
) {
  return Matrix4.multiplyByPointAsVector(
    Transforms.eastNorthUpToFixedFrame(position),
    new Cartesian3(Math.sin(trackRadians), Math.cos(trackRadians), 0),
    new Cartesian3(),
  );
}
