import {
  HeadingPitchRoll, CallbackPositionProperty, CallbackProperty, Cartesian2, Cartesian3, Color,
  ConstantProperty, EasingFunction, Ellipsoid, JulianDate,
  LabelStyle, Material, Math as CesiumMath, Matrix3, Matrix4, NearFarScalar,
  PolylineCollection, Simon1994PlanetaryPositions, Transforms, Viewer
} from "cesium";
import { useAuroraStore } from "../../store/auroraStore";
import { useSceneStore, type CameraPreset } from "../../store/sceneStore";
import { propagatedPosition, predictedOrbit, hasCurrentElements } from "../../utils/propagation";
import type { Satellite } from "../../types/space";
import { coverageRadiusKm } from "../../utils/coverageFootprint";

interface FocusTarget { satellite: Satellite; position: Cartesian3 }
interface SceneAccess {
  selected: () => FocusTarget | null;
  catalog: () => Satellite[];
  helioHome: () => void;
}

/** Owns presentation controls without rebuilding the orbital simulation. */
export function enhanceScene(viewer: Viewer, access: SceneAccess) {
  const accent = Color.fromCssColorString("#72e5d5");
  const focusPosition = new Cartesian3();
  let groundPosition = new Cartesian3();
  let footprintRadius = 1;
  let selectedId: number | null = null;
  let catalogReference: Satellite[] | null = null;
  let lastInteraction = performance.now();
  let lastGeometryUpdate = 0;
  let orbitKey = "";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const paths = viewer.scene.primitives.add(new PolylineCollection()) as PolylineCollection;
  const focusEntity = viewer.entities.add({
    show: false,
    model: { uri: import.meta.env.BASE_URL + "models/satellite.glb", minimumPixelSize: 88, maximumScale: 200000, silhouetteColor: accent, silhouetteSize: 1.5 },
    name: "Selected satellite",
    position: new CallbackPositionProperty(() => focusPosition, false),
    viewFrom: new Cartesian3(0, -700_000, 450_000),
    label: {
      text: "", font: "12px 'JetBrains Mono', monospace", fillColor: accent,
      style: LabelStyle.FILL_AND_OUTLINE, outlineColor: Color.BLACK, outlineWidth: 3,
      pixelOffset: new Cartesian2(0, -24), showBackground: true,
      backgroundColor: Color.fromCssColorString("#071820").withAlpha(0.9),
      backgroundPadding: new Cartesian2(10, 7),
      scaleByDistance: new NearFarScalar(1e6, 1, 8e7, 0.65)
    }
  });
  const footprint = viewer.entities.add({
    show: false,
    position: new CallbackPositionProperty(() => groundPosition, false),
    ellipse: {
      semiMajorAxis: new CallbackProperty(() => footprintRadius, false),
      semiMinorAxis: new CallbackProperty(() => footprintRadius, false),
      height: 1500, material: accent.withAlpha(0.09), outline: true,
      outlineColor: accent.withAlpha(0.55), granularity: CesiumMath.toRadians(3)
    }
  });
  const tether = viewer.entities.add({
    show: false,
    polyline: { positions: new CallbackProperty(() => [groundPosition, focusPosition], false), width: 1, material: accent.withAlpha(0.35) }
  });

  function applyQuality() {
    const { quality, lighting } = useSceneStore.getState();
    viewer.useBrowserRecommendedResolution = true;
    viewer.resolutionScale = quality === "cinematic" ? Math.min(window.devicePixelRatio, 1.6) : quality === "performance" ? 0.8 : 1;
    viewer.targetFrameRate = quality === "performance" ? 30 : 60;
    viewer.scene.msaaSamples = quality === "performance" ? 1 : 4;
    viewer.scene.globe.maximumScreenSpaceError = quality === "cinematic" ? 1.5 : quality === "performance" ? 4 : 2;
    viewer.scene.globe.enableLighting = lighting;
    viewer.scene.globe.dynamicAtmosphereLighting = true;
    viewer.scene.globe.dynamicAtmosphereLightingFromSun = true;
    viewer.scene.globe.atmosphereLightIntensity = 12;
    viewer.scene.postProcessStages.fxaa.enabled = quality !== "performance";
    const bloom = viewer.scene.postProcessStages.bloom;
    bloom.enabled = quality === "cinematic";
    bloom.uniforms.glowOnly = false;
    bloom.uniforms.contrast = 110;
    bloom.uniforms.brightness = -0.35;
    bloom.uniforms.delta = 0.7;
    bloom.uniforms.sigma = 2.5;
    bloom.uniforms.stepSize = 1;
    viewer.scene.highDynamicRange = quality !== "performance";
    viewer.scene.requestRender();
  }

  function releaseCamera() {
    viewer.trackedEntity = undefined;
    viewer.camera.lookAtTransform(Matrix4.IDENTITY);
  }

  function fly(preset: CameraPreset) {
    releaseCamera();
    const app = useAuroraStore.getState();
    if (app.currentMode === "HELIO" && !app.earthOnlyMode) { access.helioHome(); return; }
    const time = viewer.clock.currentTime;
    const sun = Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time);
    const rotation = Transforms.computeIcrfToFixedMatrix(time) ?? Transforms.computeTemeToPseudoFixedMatrix(time);
    const sunDirection = Cartesian3.normalize(Matrix3.multiplyByVector(rotation, sun, new Cartesian3()), new Cartesian3());
    let direction: Cartesian3;
    if (preset === "polar") direction = Cartesian3.normalize(new Cartesian3(0.06, -0.05, 1), new Cartesian3());
    else {
      const edge = Cartesian3.normalize(Cartesian3.cross(sunDirection, Cartesian3.UNIT_Z, new Cartesian3()), new Cartesian3());
      direction = Cartesian3.add(Cartesian3.multiplyByScalar(sunDirection, preset === "terminator" ? 0.16 : 1, new Cartesian3()), Cartesian3.multiplyByScalar(edge, preset === "terminator" ? 1 : 0.38, new Cartesian3()), new Cartesian3());
      direction.z += preset === "terminator" ? 0.12 : 0.28;
      Cartesian3.normalize(direction, direction);
    }
    viewer.camera.flyTo({
      destination: Cartesian3.multiplyByScalar(direction, preset === "polar" ? 22_000_000 : 25_000_000, new Cartesian3()),
      orientation: { direction: Cartesian3.negate(direction, new Cartesian3()), up: preset === "polar" ? Cartesian3.UNIT_Y : Cartesian3.UNIT_Z },
      duration: reducedMotion ? 0 : 1.8, easingFunction: EasingFunction.QUADRATIC_IN_OUT
    });
    lastInteraction = performance.now();
  }

  function rebuildPaths() {
    const settings = useSceneStore.getState();
    const catalog = access.catalog();
    const selected = access.selected();
    const key = `${settings.orbitPaths}:${selected?.satellite.noradId}:${Math.floor(Date.now()/60000)}`;
    if (catalogReference === catalog && orbitKey === key) return;
    catalogReference = catalog; orbitKey = key;
    paths.removeAll();
    if (!settings.orbitPaths || !selected || !hasCurrentElements(selected.satellite)) return;
    const positions = predictedOrbit(selected.satellite);
    if (positions.length) paths.add({ positions, width: 2,
      material: Material.fromType("PolylineGlow", { color: accent.withAlpha(0.8), glowPower: 0.13, taperPower: 1 }) });
  }

  function update(_time: JulianDate, deltaSeconds: number) {
    const app = useAuroraStore.getState();
    const settings = useSceneStore.getState();
    const earth = app.currentMode !== "HELIO" && !app.earthOnlyMode;
    const selected = earth ? access.selected() : null;
    focusEntity.show = Boolean(selected);
    paths.show = earth && settings.orbitPaths;
    footprint.show = tether.show = Boolean(selected && settings.coverage);
    if (selected) {
      Cartesian3.clone(propagatedPosition(selected.satellite) ?? selected.position, focusPosition);
      focusEntity.orientation = new ConstantProperty(Transforms.headingPitchRollQuaternion(focusPosition, new HeadingPitchRoll(0, 0, 0)));
      if (selectedId !== selected.satellite.noradId) {
        selectedId = selected.satellite.noradId;
        focusEntity.label!.text = new ConstantProperty(selected.satellite.name);
        const kind = selectedId === 25544 ? "station" : /\bDEB\b|DEBRIS/i.test(selected.satellite.name) ? "debris" : /R\/B|ROCKET/i.test(selected.satellite.name) ? "rocket" : "satellite";
        focusEntity.model!.uri = new ConstantProperty(import.meta.env.BASE_URL + `models/${kind}.glb`);
      }
      if (performance.now() - lastGeometryUpdate > 100) {
        groundPosition = Ellipsoid.WGS84.scaleToGeodeticSurface(focusPosition, groundPosition) ?? groundPosition;
        footprintRadius = Math.max(1, coverageRadiusKm(Math.max(0, selected.satellite.altitudeKm)) * 1000);
        lastGeometryUpdate = performance.now();
      }
      if (settings.following && viewer.trackedEntity !== focusEntity) {
        viewer.camera.cancelFlight();
        viewer.trackedEntity = focusEntity;
      }
    } else if (settings.following) useSceneStore.getState().setFollowing(false);
    if (!settings.following && viewer.trackedEntity === focusEntity) releaseCamera();
    if (settings.autoRotate && !settings.following && !reducedMotion && app.currentMode !== "HELIO" && !app.earthOnlyMode && performance.now() - lastInteraction > 3500) {
      viewer.camera.rotate(Cartesian3.UNIT_Z, deltaSeconds * 0.022);
    }
    rebuildPaths();
  }

  const interaction = () => { lastInteraction = performance.now(); };
  viewer.canvas.addEventListener("pointerdown", interaction);
  viewer.canvas.addEventListener("wheel", interaction, { passive: true });
  const unsubscribe = useSceneStore.subscribe((state, previous) => {
    if (state.quality !== previous.quality || state.lighting !== previous.lighting) applyQuality();
    if (!state.following && previous.following) releaseCamera();
    if (state.commandId !== previous.commandId) {
      if (state.command === "zoom-in") viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.3);
      else if (state.command === "zoom-out") viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.4);
      else fly(state.command);
    }
  });
  applyQuality();
  return { update, home: () => fly("home"), dispose: () => {
    unsubscribe();
    viewer.canvas.removeEventListener("pointerdown", interaction);
    viewer.canvas.removeEventListener("wheel", interaction);
    // The viewer owns the primitives and entities and destroys them on unmount.
  } };
}
