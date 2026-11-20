import { useEffect, useRef, useState } from "react";
import {
  Viewer,
  Color,
  Cartesian3,
  Cartesian2,
  Math as CMath,
  HeadingPitchRange,
  HeadingPitchRoll,
  Transforms,
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
}
export function RaceScene(props: Props) {
  const root = useRef<HTMLDivElement>(null),
    latest = useRef(props);
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
    alignmentRef.current = null;
    setAlignmentState("Waiting for position data");
  }, [props.race.Circuit.circuitId]);
  useEffect(() => {
    if (!root.current) return;
    const v = new Viewer(root.current, {
      baseLayer: false,
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      shouldAnimate: true,
    });
    viewerRef.current = v;
    v.scene.backgroundColor = Color.fromCssColorString("#080d14");
    v.scene.globe.baseColor = Color.fromCssColorString("#162430");
    v.scene.globe.enableLighting = false;
    v.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        credit:
          "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maximumLevel: 19,
      }),
    );
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
      v.entities.add({
        polyline: {
          positions: ps,
          width: 16,
          material: Color.fromCssColorString("#151a24"),
        },
      });
      v.entities.add({
        polyline: {
          positions: ps,
          width: 3,
          material: Color.fromCssColorString("#f6f0e5"),
        },
      });
      const p = props.track.coordinates[0];
      v.entities.add({
        position: Cartesian3.fromDegrees(p[0], p[1], 5),
        label: {
          text: "START / FINISH",
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
    const cars = new Map<number, Entity>();
    const heading = new Map<number, number>();
    const tick = v.clock.onTick.addEventListener(() => {
      const p = latest.current,
        a = alignmentRef.current;
      if (!a || !layout) {
        for (const e of cars.values()) e.show = false;
        return;
      }
      for (const driver of p.drivers) {
        const group = samplesRef.current.get(driver.driver_number) || [],
          xy = samplePosition(group, p.time);
        let entity = cars.get(driver.driver_number);
        if (!xy) {
          if (entity) entity.show = false;
          continue;
        }
        const en = transform(xy, a),
          longitude =
            layout.lon +
            en[0] / (111320 * Math.cos((layout.lat * Math.PI) / 180)),
          latitude = layout.lat + en[1] / 111320;
        const pos = Cartesian3.fromDegrees(longitude, latitude, 2);
        const next = samplePosition(group, p.time + 250),
          prev = samplePosition(group, p.time - 250);
        let h = heading.get(driver.driver_number) || 0;
        if (next || prev) {
          const other = transform((next || prev)!, a);
          const dx = next ? other[0] - en[0] : en[0] - other[0],
            dy = next ? other[1] - en[1] : en[1] - other[1];
          if (Math.hypot(dx, dy) > 0.05) h = Math.atan2(dx, dy);
        }
        heading.set(driver.driver_number, h);
        const color = Color.fromCssColorString(
          "#" +
            (/^[0-9a-f]{6}$/i.test(driver.team_colour)
              ? driver.team_colour
              : "eeeeee"),
        );
        if (!entity) {
          entity = v.entities.add({
            id: "f1-" + driver.driver_number,
            name: driver.full_name,
            position: pos,
            model: {
              uri: import.meta.env.BASE_URL + "events/car.glb",
              minimumPixelSize: 22,
              maximumScale: 5,
              color,
              colorBlendMode: ColorBlendMode.MIX,
              colorBlendAmount: 0.65,
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
        entity.show = p.watching;
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
      const chosen = p.selected ? cars.get(p.selected) : undefined;
      if (p.follow && chosen?.show) {
        if (v.trackedEntity !== chosen) v.trackedEntity = chosen;
      } else if (v.trackedEntity) v.trackedEntity = undefined;
    });
    const handler = new ScreenSpaceEventHandler(v.scene.canvas);
    handler.setInputAction((e: { position: Cartesian2 }) => {
      const picked = v.scene.pick(e.position);
      if (
        picked?.id instanceof Entity &&
        String(picked.id.id).startsWith("f1-")
      )
        latest.current.onSelect(Number(String(picked.id.id).slice(3)));
    }, ScreenSpaceEventType.LEFT_CLICK);
    const resize = new ResizeObserver(() => v.resize());
    resize.observe(root.current);
    return () => {
      resize.disconnect();
      tick();
      handler.destroy();
      v.destroy();
      viewerRef.current = undefined;
    };
  }, [props.race.Circuit.circuitId, props.track]);
  const changeView = (kind: string) => {
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
      <div ref={root} className="race-canvas" />
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
          {props.watching
            ? alignmentState
            : "Select a session to load real car positions"}
        </span>
      </div>
    </div>
  );
}
