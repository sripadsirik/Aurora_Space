import { useAuroraStore } from "../store/auroraStore";
import {
  CallbackPositionProperty,
  CallbackProperty,
  Cartesian3,
  Cartographic,
  Color,
  CustomDataSource,
  HeadingPitchRange,
  Matrix3,
  Matrix4,
  Quaternion,
  Transforms,
  sampleTerrainMostDetailed,
  PolylineGlowMaterialProperty,
  type Viewer,
} from "cesium";
import { useAerospace } from "./store";
import { useSceneStore } from "../store/sceneStore";
export const ASCENT_DURATION = 180;
export function ascentSample(seconds: number) {
  const t = Math.max(0, Math.min(ASCENT_DURATION, seconds));
  return {
    altitude: 4 * t * t,
    downrange: 0.8 * Math.max(0, t - 20) ** 2,
    tilt: Math.min(0.9, t / 200),
  };
}
export function installLiftoff(viewer: Viewer) {
  const ds = new CustomDataSource("illustrative-liftoff");
  void viewer.dataSources.add(ds);
  let active = "",
    baseHeight = 0,
    ready = false,
    disposed = false,
    previous = performance.now(),
    lastUI = 0;
  let followPosition: Cartesian3 | null = null;
  let replaySeconds = 0,
    lastPublishedSeconds = -1,
    previousPlaying = false;
  const reset = () => {
    ds.entities.removeAll();
    poses.clear();
    trailPositions = [];
    active = "";
    ready = false;
    followPosition = null;
    replaySeconds = 0;
    lastPublishedSeconds = -1;
  };
  const poses = new Map<string, Cartesian3>();
  let frameOrientation = Quaternion.IDENTITY;
  let trailPositions: Cartesian3[] = [];
  const shape = (
    id: string,
    length: number,
    top: number,
    bottom: number,
    color: Color,
  ) =>
    ds.entities.add({
      id,
      position: new CallbackPositionProperty(
        () => poses.get(id) || Cartesian3.ZERO,
        false,
      ),
      orientation: new CallbackProperty(() => frameOrientation, false),
      cylinder: {
        length,
        topRadius: top,
        bottomRadius: bottom,
        material: color,
        numberOfVerticalLines: 0,
        slices: 32,
      },
    });
  const tick = () => {
    if (disposed) return;
    const state = useAerospace.getState(),
      sim = state.simulation,
      now = performance.now(),
      delta = Math.min(0.1, (now - previous) / 1000);
    previous = now;
    if (!sim) {
      if (active) reset();
      return;
    }
    if (useAuroraStore.getState().currentMode === "HELIO") {
      state.set({ simulation: null });
      reset();
      return;
    }
    const launch = state.launches.find((l) => l.id === sim.launchId);
    if (
      !launch ||
      launch.lat === null ||
      launch.lon === null ||
      state.selected !== "launch:" + launch.id
    ) {
      state.set({ simulation: null });
      reset();
      return;
    }
    if (active !== launch.id) {
      reset();
      active = launch.id;
      const id = active;
      viewer.camera.cancelFlight();
      viewer.trackedEntity = undefined;
      useAuroraStore.getState().setSelectedSatellite(null);
      useSceneStore.setState({ following: false, autoRotate: false });
      ds.entities.add({
        id: "vehicle",
        position: new CallbackPositionProperty(
          () => poses.get("vehicle") || Cartesian3.ZERO,
          false,
        ),
        orientation: new CallbackProperty(() => frameOrientation, false),
        model: {
          uri: import.meta.env.BASE_URL + "models/launch-vehicle.glb",
          minimumPixelSize: 60,
        },
      });
      shape("exhaust", 28, 1.4, 5, Color.ORANGE.withAlpha(0.8));
      shape("core", 20, 0.8, 2.5, Color.LIGHTYELLOW.withAlpha(0.95));

      ds.entities.add({
        id: "trail",
        polyline: {
          positions: new CallbackProperty(() => trailPositions, false),
          width: 3,
          material: new PolylineGlowMaterialProperty({
            color: Color.ORANGE,
            glowPower: 0.2,
          }),
        },
      });
      const point = Cartographic.fromDegrees(launch.lon, launch.lat);
      baseHeight = viewer.scene.globe.getHeight(point) || 0;
      // Resolve terrain before ignition, so mountain launch sites cannot swallow the rocket.
      const finish = (height: number) => {
        if (
          !disposed &&
          active === id &&
          useAerospace.getState().simulation?.launchId === id
        ) {
          baseHeight = height;
          ready = true;
          useAerospace.getState().set({
            simulation: {
              ...useAerospace.getState().simulation!,
              terrainReady: true,
            },
          });
        }
      };
      if (viewer.terrainProvider.availability)
        void sampleTerrainMostDetailed(viewer.terrainProvider, [point])
          .then((points) =>
            finish(
              Number.isFinite(points[0].height) ? points[0].height : baseHeight,
            ),
          )
          .catch(() => finish(baseHeight));
      else finish(baseHeight);
    }
    if (!ready) return;
    if (sim.seconds !== lastPublishedSeconds || sim.playing !== previousPlaying)
      replaySeconds = sim.seconds;
    previousPlaying = sim.playing;
    const seconds = Math.min(
      ASCENT_DURATION,
      replaySeconds + (sim.playing ? delta * sim.rate : 0),
    );
    replaySeconds = seconds;
    const p = ascentSample(seconds);
    // Generic eastward illustrative profile, independent of provider launch schedules.
    const lat = launch.lat,
      lon =
        launch.lon +
        p.downrange / (111320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
    const center = Cartesian3.fromDegrees(
      lon,
      lat,
      baseHeight + 30 + p.altitude,
    );
    const enu = Transforms.eastNorthUpToFixedFrame(center);
    const localTilt = Matrix3.fromRotationY(p.tilt);
    const rot = Matrix3.multiply(
      Matrix4.getMatrix3(enu, new Matrix3()),
      localTilt,
      new Matrix3(),
    );
    frameOrientation = Quaternion.fromRotationMatrix(rot);
    const pose = (id: string, z: number, x = 0) => {
      const offset = Matrix3.multiplyByVector(
        rot,
        new Cartesian3(x, 0, z),
        new Cartesian3(),
      );
      poses.set(id, Cartesian3.add(center, offset, offset));
    };
    pose("vehicle", -30);
    const burning = seconds > 0 && seconds < ASCENT_DURATION;
    pose("exhaust", -40);
    pose("core", -35);
    ds.entities.getById("exhaust")!.show = burning;
    ds.entities.getById("core")!.show = burning;
    const positions = [];
    for (let t = 0; t <= seconds; t += 3) {
      const a = ascentSample(t);
      positions.push(
        Cartesian3.fromDegrees(
          launch.lon +
            a.downrange /
              (111320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180))),
          lat,
          baseHeight + 6 + a.altitude,
        ),
      );
    }
    trailPositions = positions.length > 1 ? positions : [center, center];
    followPosition = Cartesian3.clone(center);
    if (now - lastUI > 100) {
      lastUI = now;
      lastPublishedSeconds = seconds;
      state.set({
        simulation: {
          ...sim,
          terrainReady: true,
          seconds,
          playing: sim.playing && seconds < ASCENT_DURATION,
        },
      });
    }
    viewer.scene.requestRender();
  };
  viewer.scene.preRender.addEventListener(tick);
  return {
    target: () => followPosition,
    dispose: () => {
      disposed = true;
      useAerospace.getState().set({ simulation: null });
      viewer.scene.preRender.removeEventListener(tick);
      reset();
      if (!viewer.isDestroyed()) viewer.dataSources.remove(ds, true);
    },
  };
}
