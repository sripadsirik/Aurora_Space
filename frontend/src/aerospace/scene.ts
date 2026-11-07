import { installLiveRocket } from "./liveRocket";
import { aircraftAttitude, aircraftCourseVector } from "./aircraftAttitude";
import { installLiftoff } from "./liftoff";
import { installAerospaceTracking } from "./tracking";
import { AircraftMotion } from "./smoothMotion";
import {
  CallbackPositionProperty,
  BoundingSphere,
  Intersect,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ConstantProperty,
  CustomDataSource,
  HeadingPitchRoll,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  ModelGraphics,
  PolylineGlowMaterialProperty,
  Transforms,
  VerticalOrigin,
  type Viewer,
} from "cesium";
import { useAerospace } from "./store";
import { useAuroraStore } from "../store/auroraStore";
import { GlobeOcclusion } from "../utils/globeOcclusion";
const assets = import.meta.env.BASE_URL + "models/";
export function installAerospace(viewer: Viewer): () => void {
  const live = installLiveRocket(viewer);
  const liftoff = installLiftoff(viewer),
    source = new CustomDataSource("aerospace");
  let disposed = false;
  const occlusion = new GlobeOcclusion(viewer.scene.globe.ellipsoid, viewer.camera.positionWC);
  const visibilitySphere = new BoundingSphere(new Cartesian3(), 50000);
  const motion = new Map<string, AircraftMotion>(),
    trails = new Map<string, { time: number; position: Cartesian3 }[]>();
  void viewer.dataSources.add(source).then(() => {
    if (disposed && !viewer.isDestroyed())
      viewer.dataSources.remove(source, true);
  });
  const tracking = installAerospaceTracking(
    viewer,
    (id) =>
      source.entities.getById(id)?.position?.getValue(viewer.clock.currentTime),
    liftoff.target,
    live.target,
  );
  const render = () => {
    if (disposed || viewer.isDestroyed()) return;
    const s = useAerospace.getState(),
      now = Date.now(),
      keep = new Set<string>();
    source.show = useAuroraStore.getState().currentMode !== "HELIO";
    occlusion.cameraPosition = viewer.camera.positionWC;
    const viewVolume = viewer.camera.frustum.computeCullingVolume(viewer.camera.positionWC, viewer.camera.directionWC, viewer.camera.upWC);
    const candidates = s.aircraft.filter(
      (a) => {
        if (!s.aircraftOn || (s.militaryOnly && !a.military) || now - a.observedAt > 90000 || a.observedAt - now > 5000) return false;
        if (s.selected === "air:" + a.id) return true;
        // Keep the full worldwide feed in state; only create meshes and callbacks
        // for objects in view. The 50 km margin accommodates bounded motion.
        Cartesian3.fromDegrees(a.lon, a.lat, Math.max(0, a.altitudeM), undefined, visibilitySphere.center);
        return occlusion.isPointVisible(visibilitySphere.center) && viewVolume.computeVisibility(visibilitySphere) !== Intersect.OUTSIDE;
      },
    );
    for (const a of candidates) {
      const id = "air:" + a.id;
      let track = motion.get(id);
      if (!track) {
        track = new AircraftMotion(a);
        motion.set(id, track);
      } else track.update(a, now);
    }
    const nearModels = new Set(
      candidates
        .map((a) => ({
          id: "air:" + a.id,
          distance: Cartesian3.distanceSquared(
            motion.get("air:" + a.id)!.position(now),
            viewer.camera.positionWC,
          ),
        }))
        .filter((a) => a.distance < 100000 ** 2)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 48)
        .map((a) => a.id),
    );
    for (const a of candidates) {
      const id = "air:" + a.id,
        track = motion.get(id)!;
      keep.add(id);
      const selected = s.selected === id,
        color = Color.fromCssColorString(a.military ? "#ffbc69" : "#66e3ef");
      let entity = source.entities.getById(id);
      if (!entity)
        entity = source.entities.add({
          id,
          name: a.name,
          position: new CallbackPositionProperty(
            (_time, result) => track.position(Date.now(), result),
            false,
          ),
          orientation: new CallbackProperty(
            () =>
              aircraftAttitude(
                track.position(Date.now()),
                track.heading(Date.now()),
              ),
            false,
          ),
          billboard: {
            image: assets + "aircraft-icon.svg",
            width: 26,
            height: 26,
            alignedAxis: new CallbackProperty(
              () =>
                aircraftCourseVector(
                  track.position(Date.now()),
                  track.heading(Date.now()),
                ),
              false,
            ),
            disableDepthTestDistance: 0,
          },
        });
      const near = nearModels.has(id);
      const kind = /^(F16|F15|F18|F22|F35|EUFI|RFAL|SU27|SU30|MIG)/i.test(
        a.model,
      )
        ? "fighter"
        : "airliner";
      if (near && !entity.model)
        entity.model = new ModelGraphics({
          uri: assets + kind + ".glb",
          minimumPixelSize: 36,
        });
      if (!near && entity.model) entity.model = undefined;
      entity.billboard!.show = new ConstantProperty(!near);
      entity.billboard!.color = new ConstantProperty(
        now - a.observedAt > 30000 ? Color.GRAY : color,
      );
      entity.billboard!.scale = new ConstantProperty(selected ? 1.4 : 1);
      const history = trails.get(id) || [];
      if (!history.length || a.observedAt > history[history.length - 1].time) {
        if (
          history.length &&
          a.observedAt - history[history.length - 1].time > 90000
        )
          history.length = 0;
        history.push({
          time: a.observedAt,
          position: Cartesian3.fromDegrees(
            a.lon,
            a.lat,
            Math.max(0, a.altitudeM),
          ),
        });
      }
      while (
        history.length > 60 ||
        (history.length && now - history[0].time > 600000)
      )
        history.shift();
      trails.set(id, history);
      if (selected && history.length > 1) {
        keep.add(id + ":trail");
        const positions = history.map((h) => h.position);
        let line = source.entities.getById(id + ":trail");
        if (!line)
          line = source.entities.add({
            id: id + ":trail",
            polyline: {
              positions,
              width: 2,
              material: new PolylineGlowMaterialProperty({ color }),
            },
          });
        else line.polyline!.positions = new ConstantProperty(positions);
      }
    }
    if (s.launchesOn)
      for (const l of s.launches) {
        if (l.lat === null || l.lon === null) continue;
        const id = "launch:" + l.id;
        keep.add(id);
        const selected = s.selected === id;
        let entity = source.entities.getById(id);
        if (!entity)
          entity = source.entities.add({
            id,
            name: l.name,
            position: Cartesian3.fromDegrees(l.lon, l.lat),
            orientation: Transforms.headingPitchRollQuaternion(
              Cartesian3.fromDegrees(l.lon, l.lat),
              new HeadingPitchRoll(),
            ),
            billboard: {
              image: assets + "rocket-icon.svg",
              width: 30,
              height: 36,
              verticalOrigin: VerticalOrigin.BOTTOM,
              heightReference: HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: 0,
            },
            label: {
              text: l.rocket + " · LAUNCH SITE",
              font: "13px sans-serif",
              fillColor: Color.WHITE,
              outlineColor: Color.BLACK,
              outlineWidth: 3,
              style: LabelStyle.FILL_AND_OUTLINE,
              showBackground: true,
              backgroundColor:
                Color.fromCssColorString("#101c30").withAlpha(0.95),
              backgroundPadding: new Cartesian2(10, 7),
              pixelOffset: new Cartesian2(0, -48),
              horizontalOrigin: HorizontalOrigin.CENTER,
              verticalOrigin: VerticalOrigin.BOTTOM,
              heightReference: HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: 0,
              show: selected,
            },
          });
        entity.show =
          s.simulation?.launchId !== l.id &&
          !(
            s.rocketTelemetry.missionId === l.id &&
            s.rocketTelemetry.positions.length > 0
          );
        const near =
          Cartesian3.distance(
            viewer.camera.positionWC,
            Cartesian3.fromDegrees(l.lon, l.lat),
          ) < 100000;
        if (near && !entity.model)
          entity.model = new ModelGraphics({
            uri: assets + "launch-vehicle.glb",
            minimumPixelSize: 52,
            heightReference: HeightReference.CLAMP_TO_GROUND,
          });
        if (!near && entity.model) entity.model = undefined;
        entity.billboard!.show = new ConstantProperty(!near);
        entity.label!.show = new ConstantProperty(selected);
      }
    for (const entity of [...source.entities.values])
      if (!keep.has(entity.id)) source.entities.remove(entity);
    for (const id of motion.keys())
      if (!keep.has(id)) {
        motion.delete(id);
        trails.delete(id);
      }
    viewer.scene.requestRender();
  };
  const unsub = useAerospace.subscribe((s, old) => {
    if (s.region !== old.region) {
      trails.clear();
      motion.clear();
      source.entities.removeAll();
    }
    if (s.scanId !== old.scanId) {
      const c = Cartographic.fromCartesian(viewer.camera.positionWC);
      s.set({
        region: `point/${Math.round(CesiumMath.toDegrees(c.latitude))}/${Math.round(CesiumMath.toDegrees(c.longitude))}`,
        selected: null,
        aircraftFollow: false,
      });
      return;
    }
    if (
      s.aircraft !== old.aircraft ||
      s.launches !== old.launches ||
      s.selected !== old.selected ||
      s.aircraftOn !== old.aircraftOn ||
      s.launchesOn !== old.launchesOn ||
      s.militaryOnly !== old.militaryOnly ||
      s.simulation?.launchId !== old.simulation?.launchId
    )
      render();
    if (s.focusId !== old.focusId && s.selected) {
      const p = source.entities
        .getById(s.selected)
        ?.position?.getValue(viewer.clock.currentTime);
      if (p) {
        const c = Cartographic.fromCartesian(p);
        viewer.camera.flyTo({
          destination: Cartesian3.fromRadians(c.longitude, c.latitude, 350000),
          orientation: { heading: 0, pitch: -CesiumMath.PI_OVER_TWO, roll: 0 },
          duration: 1.5,
        });
      }
    }
  });
  const mode = useAuroraStore.subscribe((s, old) => {
    if (s.currentMode !== old.currentMode) render();
  });
  const timer = setInterval(render, 500);
  render();
  return () => {
    disposed = true;
    tracking();
    liftoff.dispose();
    live.dispose();
    unsub();
    mode();
    clearInterval(timer);
    if (!viewer.isDestroyed()) viewer.dataSources.remove(source, true);
  };
}
