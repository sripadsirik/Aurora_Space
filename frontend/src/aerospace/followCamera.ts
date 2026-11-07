import {
  CallbackPositionProperty,
  Cartesian3,
  ConstantProperty,
  Entity,
  EntityView,
  HeadingPitchRange,
  JulianDate,
  Matrix4,
  TrackingReferenceFrame,
  type Viewer,
} from "cesium";
/** Cesium's entity tracker preserves mouse orbit and wheel zoom between updates. */
export function createFollowCamera(viewer: Viewer) {
  const center = new Cartesian3();
  let view: EntityView | null = null;
  return {
    update(position: Cartesian3, initial: HeadingPitchRange) {
      Cartesian3.clone(position, center);
      if (!view) {
        viewer.camera.cancelFlight();
        viewer.trackedEntity = undefined;
        viewer.camera.lookAt(center, initial);
        const target = new Entity({
          position: new CallbackPositionProperty(() => center, false),
          viewFrom: new ConstantProperty(
            Cartesian3.clone(viewer.camera.position),
          ),
          trackingReferenceFrame: TrackingReferenceFrame.ENU,
        });
        view = new EntityView(target, viewer.scene);
      }
      view.update(JulianDate.now());
    },
    release() {
      if (view && !viewer.isDestroyed()) {
        viewer.camera.lookAtTransform(Matrix4.IDENTITY);
        viewer.camera.setView({
          orientation: {
            heading: viewer.camera.heading,
            pitch: viewer.camera.pitch,
            roll: 0,
          },
        });
      }
      view = null;
    },
  };
}
