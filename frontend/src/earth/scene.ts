import {
  Cartesian3,
  Cartesian2,
  LabelStyle,
  Color,
  CustomDataSource,
  HeightReference,
  UrlTemplateImageryProvider,
  type ImageryLayer,
  Math as CesiumMath,
  type Viewer,
} from "cesium";
import { useEarth } from "./store";
import { useAerospace } from "../aerospace/store";
import { useSceneStore } from "../store/sceneStore";
import { useAuroraStore } from "../store/auroraStore";
import { filterCameras } from "./cameraNetworks";
const icon =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="3" y="9" width="20" height="15" rx="3" fill="#b2e4df" stroke="#152e39" stroke-width="2"/><path d="M23 13L30 9V24L23 20Z" fill="#9ad1cf"/><circle cx="13" cy="16" r="5" fill="#183d50"/></svg>',
  );
export function installEarth(viewer: Viewer) {
  const source = new CustomDataSource("public-traffic-cameras");
  let disposed = false;
  let streets: ImageryLayer | undefined;
  const updateMap = () => {
    const enabled =
      useEarth.getState().mapStyle === "streets" &&
      useAuroraStore.getState().currentMode !== "HELIO";
    if (enabled && !streets)
      streets = viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          maximumLevel: 19,
          credit:
            '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
          enablePickFeatures: false,
        }),
      );
    if (streets) {
      streets.show = enabled;
      if (enabled) viewer.imageryLayers.raiseToTop(streets);
    }
  };
  const layerAdded = () => {
    if (streets && streets.show) viewer.imageryLayers.raiseToTop(streets);
  };
  viewer.imageryLayers.layerAdded.addEventListener(layerAdded);
  void viewer.dataSources.add(source).then(() => {
    if (disposed && !viewer.isDestroyed())
      viewer.dataSources.remove(source, true);
  });
  const render = () => {
    source.entities.removeAll();
    const s = useEarth.getState();
    source.show =
      s.camerasOn && useAuroraStore.getState().currentMode !== "HELIO";
    if (!s.camerasOn) return;
    for (const c of filterCameras(s.cameras, s.cameraNetwork, s.cameraArea))
      source.entities.add({
        id: c.id,
        name: c.name,
        position: Cartesian3.fromDegrees(c.lon, c.lat),
        billboard: {
          image: icon,
          width: 28,
          height: 28,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 0,
          color:
            c.id === s.selected
              ? Color.WHITE
              : Color.fromCssColorString("#b2e4df"),
        },
        label: {
          text: c.name,
          show: c.id === s.selected,
          font: "12px sans-serif",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          pixelOffset: new Cartesian2(0, -30),
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 0,
        },
      });
  };
  const unsub = useEarth.subscribe((s, old) => {
    if (s.mapStyle !== old.mapStyle) updateMap();
    if (
      s.cameras !== old.cameras ||
      s.camerasOn !== old.camerasOn ||
      s.selected !== old.selected
      || s.cameraNetwork !== old.cameraNetwork || s.cameraArea !== old.cameraArea
    )
      render();
    if (s.destinationId !== old.destinationId && s.destination) {
      const air = useAerospace.getState();
      air.set({
        aircraftFollow: false,
        launchCameraFollow: false,
        ...(air.simulation
          ? { simulation: { ...air.simulation, follow: false } }
          : {}),
      });
      useSceneStore.setState({ following: false, autoRotate: false });
      const d = s.destination;
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(d.lon, d.lat, 1500),
        orientation: { heading: 0, pitch: -CesiumMath.PI_OVER_TWO, roll: 0 },
        duration: 1.7,
      });
    }
  });
  const mode = useAuroraStore.subscribe((s, old) => {
    if (s.currentMode !== old.currentMode) {
      render();
      updateMap();
    }
  });
  render();
  updateMap();
  return () => {
    disposed = true;
    unsub();
    mode();
    if (!viewer.isDestroyed()) {
      viewer.imageryLayers.layerAdded.removeEventListener(layerAdded);
      viewer.dataSources.remove(source, true);
      if (streets) viewer.imageryLayers.remove(streets, true);
    }
  };
}
