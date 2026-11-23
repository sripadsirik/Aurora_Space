import { circuitSampler, estimateProgress, type TimingCar } from "./freeTiming";
import { useEvents } from "./store";
import { useEffect, useRef, useState } from "react";
import {
  CustomDataSource,
  Cartographic,
  DistanceDisplayCondition,
  HeightReference,
  Viewer,
  Color,
  Cartesian3,
  Cartesian2,
  Math as CMath,
  HeadingPitchRange,
  HeadingPitchRoll,
  Transforms,
  TrackingReferenceFrame,
  ConstantPositionProperty,
  ConstantProperty,
  ColorBlendMode,
  UrlTemplateImageryProvider,
  BoundingSphere,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Entity,
} from "cesium";
import {
  align,
  circuitPose,
  trackHeading,
  localTrack,
  transform,
  type Alignment,
  type XY,
} from "./alignment";
import {
  samplePosition,
  type Datum,
  type Driver,
  type Race,
  type Track,
} from "./data";
interface Props {
  race: Race;
  track?: Track;
  drivers: Driver[];
  locations: Datum[];
  time: number;
  selected: number | null;
  follow: boolean;
  onSelect: (n: number) => void;
  watching: boolean;
  timingCars?: TimingCar[];
  races: Race[];
  onRace: (round: string) => void;
  onRelease: () => void;
}
export function RaceScene(props: Props) {
  const viewer = useEvents((s) => s.viewer);
  const latest = useRef(props);
  latest.current = props;
  const [view, setView] = useState("track"),
    [alignmentState, setAlignmentState] = useState("Waiting for position data");
  const viewerRef = useRef<Viewer>();
  const alignmentRef = useRef<Alignment | null>(null);
  const samplesRef = useRef(new Map<number, Datum[]>());
  useEffect(() => {
    const groups = new Map<number, Datum[]>();
    for (const p of props.locations) {
      if (
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        (p.x === 0 && p.y === 0)
      )
        continue;
      const a = groups.get(p.driver_number) || [];
      a.push(p);
      groups.set(p.driver_number, a);
    }
    for (const a of groups.values())
      a.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    samplesRef.current = groups;
    if (props.track && props.locations.length && !alignmentRef.current) {
      const points = localTrack(props.track.coordinates).points;
      const longest =
        [...groups.values()].sort((a, b) => b.length - a.length)[0] || [];
      const fit = align(
        longest.map((p) => [p.x!, p.y!] as XY),
        points,
      );
      alignmentRef.current = fit;
      setAlignmentState(
        fit
          ? `Approximate positioning · ${Math.round(fit.error)} m fit error`
          : "Position alignment unavailable · cars hidden",
      );
    }
  }, [props.locations, props.track]);
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const v = viewer;
    viewerRef.current = v;
    const originalView = {
      destination: v.camera.positionWC.clone(),
      orientation: {
        direction: v.camera.directionWC.clone(),
        up: v.camera.upWC.clone(),
      },
    };
    const layer = new CustomDataSource("F1 race weekend");
    void v.dataSources.add(layer);
    const imagery = v.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        credit: "Tiles © Esri and its imagery providers",
        maximumLevel: 19,
      }),
    );
    for (const race of props.races) {
      const point = race.Circuit.Location;
      layer.entities.add({
        id: "gp-" + race.round,
        position: Cartesian3.fromDegrees(+point.long, +point.lat),
        point: {
          pixelSize: 9,
          color: Color.CORAL,
          distanceDisplayCondition: new DistanceDisplayCondition(
            20000,
            30000000,
          ),
        },
        label: {
          text: race.raceName,
          font: "13px sans-serif",
          showBackground: true,
          pixelOffset: new Cartesian2(0, -17),
          distanceDisplayCondition: new DistanceDisplayCondition(
            20000,
            30000000,
          ),
        },
      });
    }
    const location = props.race.Circuit.Location;
    const lon = Number(location.long),
      lat = Number(location.lat);
    const layout = props.track ? localTrack(props.track.coordinates) : null;
    const center = Cartesian3.fromDegrees(
      layout?.lon ?? lon,
      layout?.lat ?? lat,
      0,
    );
    if (props.track) {
      const ps = props.track.coordinates.map((p) =>
        Cartesian3.fromDegrees(p[0], p[1], 1),
      );
      layer.entities.add({
        polyline: {
          positions: ps,
          clampToGround: true,
          width: 16,
          material: Color.fromCssColorString("#151a24"),
        },
      });
      layer.entities.add({
        polyline: {
          positions: ps,
          clampToGround: true,
          width: 3,
          material: Color.fromCssColorString("#f6f0e5"),
        },
      });
      const p = props.track.coordinates[0];
      layer.entities.add({
        position: Cartesian3.fromDegrees(p[0], p[1], 5),
        label: {
          text: "START / FINISH",
          heightReference: HeightReference.CLAMP_TO_GROUND,
          font: "bold 12px monospace",
          fillColor: Color.WHITE,
          pixelOffset: new Cartesian2(0, -20),
          showBackground: true,
          backgroundColor: Color.fromCssColorString("#e44035"),
        },
        point: { pixelSize: 8, color: Color.fromCssColorString("#ff4c3b") },
      });
    }
    const sphere = props.track
      ? BoundingSphere.fromPoints(
          props.track.coordinates.map((p) =>
            Cartesian3.fromDegrees(p[0], p[1]),
          ),
        )
      : new BoundingSphere(center, 2000);
    v.camera.flyToBoundingSphere(sphere, {
      duration: 1.5,
      offset: new HeadingPitchRange(
        CMath.toRadians(15),
        CMath.toRadians(-55),
        sphere.radius * 3.1,
      ),
    });
    const alongTrack = props.track
      ? circuitSampler(props.track.coordinates)
      : null;
    const cars = new Map<number, Entity>();
    const heading = new Map<number, number>();
    const tick = v.clock.onTick.addEventListener(() => {
      const p = latest.current,
        a = alignmentRef.current;
      if (!p.watching || (!a && !p.timingCars) || !layout) {
        if (
          v.trackedEntity &&
          cars.has(Number(String(v.trackedEntity.id).slice(3)))
        )
          v.trackedEntity = undefined;
        for (const e of cars.values()) e.show = false;
        return;
      }
      // A newly added model gets its Cesium tracking bounds on the next viewer tick.
      const selectedEntity = p.selected ? cars.get(p.selected) : undefined;
      const visible = new Set<number>();
      const clock = p.timingCars ? Date.now() : p.time;
      const metersPerDegree = 111320 * Math.cos((layout.lat * Math.PI) / 180);
      for (const driver of p.timingCars ?? p.drivers) {
        const group = samplesRef.current.get(driver.driver_number) || [];
        const positionAt = (at: number): XY | null => {
          if (p.timingCars && alongTrack) {
            const progress = estimateProgress(driver as TimingCar, at);
            if (progress === null) return null;
            const [lon, lat] = alongTrack(progress);
            return [
              (lon - layout.lon) * metersPerDegree,
              (lat - layout.lat) * 111320,
            ];
          }
          const sample = samplePosition(group, at);
          return sample && a ? transform(sample, a) : null;
        };
        const raw = positionAt(clock);
        if (!raw) continue;
        const { position: en, tangent } = circuitPose(
          raw,
          layout.points,
          Math.min(18, Math.max(6, a?.error ?? 0)),
        );
        let entity = cars.get(driver.driver_number);
        const longitude = layout.lon + en[0] / metersPerDegree,
          latitude = layout.lat + en[1] / 111320;
        const height =
          v.scene.globe.getHeight(
            Cartographic.fromDegrees(longitude, latitude),
          ) ?? 0;
        const pos = Cartesian3.fromDegrees(longitude, latitude, height + 0.25);
        const next = positionAt(clock + 250),
          prev = positionAt(clock - 250);
        const from = prev ?? raw,
          to = next ?? raw;
        const h = trackHeading(
          tangent,
          [to[0] - from[0], to[1] - from[1]],
          heading.get(driver.driver_number),
        );
        heading.set(driver.driver_number, h);
        const color = Color.fromCssColorString(
          "#" +
            (/^[0-9a-f]{6}$/i.test(driver.team_colour)
              ? driver.team_colour
              : "eeeeee"),
        );
        if (!entity) {
          entity = layer.entities.add({
            id: "f1-" + driver.driver_number,
            name: driver.full_name,
            position: pos,
            trackingReferenceFrame: TrackingReferenceFrame.INERTIAL,
            viewFrom: new Cartesian3(-32, 0, 13),
            model: {
              uri: import.meta.env.BASE_URL + "events/car.glb",
              minimumPixelSize: 22,
              maximumScale: 5,
              color,
              colorBlendMode: ColorBlendMode.HIGHLIGHT,
            },
            label: {
              text: driver.name_acronym,
              font: "bold 12px monospace",
              fillColor: color,
              pixelOffset: new Cartesian2(0, -27),
              showBackground: true,
              backgroundColor: Color.BLACK.withAlpha(0.75),
            },
          });
          cars.set(driver.driver_number, entity);
        }
        visible.add(driver.driver_number);
        entity.show = true;
        entity.position = new ConstantPositionProperty(pos);
        entity.orientation = new ConstantProperty(
          Transforms.headingPitchRollQuaternion(
            pos,
            new HeadingPitchRoll(h, 0, 0),
          ),
        );
        if (entity.label)
          entity.label.scale = new ConstantProperty(
            driver.driver_number === p.selected ? 1.2 : 1,
          );
      }
      for (const [id, entity] of cars) {
        if (!visible.has(id)) entity.show = false;
      }
      if (p.follow && selectedEntity?.show) {
        if (v.trackedEntity !== selectedEntity)
          v.trackedEntity = selectedEntity;
      } else if (v.trackedEntity) v.trackedEntity = undefined;
    });
    const handler = new ScreenSpaceEventHandler(v.scene.canvas);
    handler.setInputAction((e: { position: Cartesian2 }) => {
      const picked = v.scene.pick(e.position);
      if (picked?.id instanceof Entity && picked.id.id.startsWith("gp-"))
        latest.current.onRace(picked.id.id.slice(3));
      if (
        picked?.id instanceof Entity &&
        String(picked.id.id).startsWith("f1-")
      )
        latest.current.onSelect(Number(String(picked.id.id).slice(3)));
    }, ScreenSpaceEventType.LEFT_CLICK);
    return () => {
      tick();
      if (!handler.isDestroyed()) handler.destroy();
      if (!v.isDestroyed()) {
        v.trackedEntity = undefined;
        v.camera.cancelFlight();
        v.dataSources.remove(layer, true);
        v.imageryLayers.remove(imagery, true);
        v.camera.setView(originalView);
      }
      viewerRef.current = undefined;
    };
  }, [viewer, props.race.Circuit.circuitId, props.track, props.races]);
  const changeView = (kind: string) => {
    props.onRelease();
    setView(kind);
    const v = viewerRef.current;
    if (!v) return;
    v.trackedEntity = undefined;
    const l = props.race.Circuit.Location;
    if (kind === "earth")
      v.camera.flyTo({
        destination: Cartesian3.fromDegrees(+l.long, +l.lat, 9000000),
        duration: 1.5,
      });
    else {
      const ps = props.track?.coordinates.map((p) =>
        Cartesian3.fromDegrees(p[0], p[1]),
      );
      const sphere = ps
        ? BoundingSphere.fromPoints(ps)
        : new BoundingSphere(Cartesian3.fromDegrees(+l.long, +l.lat), 2000);
      v.camera.flyToBoundingSphere(sphere, {
        duration: 1.2,
        offset: new HeadingPitchRange(
          0,
          CMath.toRadians(kind === "overhead" ? -90 : -55),
          sphere.radius * 3.1,
        ),
      });
    }
  };
  return (
    <div className="race-scene">
      <div className="race-view-switch">
        {["earth", "track", "overhead"].map((k) => (
          <button
            key={k}
            aria-pressed={view === k}
            onClick={() => changeView(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="race-map-note">
        {props.track
          ? "REAL CIRCUIT GEOMETRY"
          : "CIRCUIT LOCATION · layout unavailable"}
        <span>
          {props.timingCars
            ? "Estimated from live lap and sector timing"
            : props.watching
              ? alignmentState
              : "Select a session to load real car positions"}
        </span>
      </div>
    </div>
  );
}
