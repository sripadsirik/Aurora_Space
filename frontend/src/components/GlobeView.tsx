import {
  BlendOption,
  CallbackProperty,
  CallbackPositionProperty,
  CameraEventType,
  Cartesian2,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  ColorMaterialProperty,
  createOsmBuildingsAsync,
  createWorldTerrainAsync,
  defined,
  EllipsoidGeometry,
  EasingFunction,
  GeometryInstance,
  Ion,
  IonImageryProvider,
  JulianDate,
  Material,
  Math as CesiumMath,
  Matrix4,
  PerInstanceColorAppearance,
  PointPrimitive,
  PointPrimitiveCollection,
  PolygonHierarchy,
  PolylineCollection,
  PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
  ScreenSpaceEventType,
  Simon1994PlanetaryPositions,
  Viewer
} from "cesium";
import { useEffect, useRef } from "react";

import { useAuroraStore } from "../store/auroraStore";
import type { ConjunctionWarning, Satellite, SpaceWeather } from "../types/space";
import { getSolarWindColor, riskColorMap } from "../utils/colors";
import {
  createHelioBandHierarchy,
  createOrbitArcPositions,
  createOrbitRingPositions,
  createSectorHierarchy,
  formatHelioArrivalLabel,
  getHelioCmeRadius,
  getHelioOrbitAngle,
  HELIO_AU_SCENE_UNITS,
  HELIO_CAMERA_DESTINATION,
  HELIO_CAMERA_PITCH,
  HELIO_CME_HALF_ANGLE,
  HELIO_L1_OFFSET,
  HELIO_ORBIT_RADII,
  HELIO_SUN_GLOW_RADIUS,
  HELIO_SUN_RADIUS,
  positionOnHelioOrbit
} from "../utils/helio";
import { env } from "../utils/env";
import { createOrbitPositions, earthRadiusMeters, getOrbitalPeriod, getOrbitParams, kpToAuroraRadiusDegrees, orbitPoint } from "../utils/orbit";

interface GlobeViewProps {
  satellites: Satellite[];
  conjunctions: ConjunctionWarning[];
  spaceWeather: SpaceWeather;
}

interface SatellitePickPayload {
  type: "satellite";
  satellite: Satellite;
}

interface SatelliteAnimState {
  point: PointPrimitive;
  satellite: Satellite;
  radius: number;
  inclination: number;
  ascendingNode: number;
  period: number;
  initialTheta: number;
}

interface ConjunctionLineState {
  conjunction: ConjunctionWarning;
  polyline: ReturnType<PolylineCollection["add"]>;
  sat1NoradId: number;
  sat2NoradId: number;
}

interface SolarWindParticle {
  primitive: PointPrimitive;
  x: number;
  y: number;
  z: number;
  speedScale: number;
}

interface SolarWindFrame {
  sunDir: Cartesian3;
  flowDir: Cartesian3;
  spawnOrigin: Cartesian3;
  streamEnd: Cartesian3;
  spreadAxisA: Cartesian3;
  spreadAxisB: Cartesian3;
}

type Showable = { show: boolean };

const EARTH_CAMERA_DESTINATION = Cartesian3.fromDegrees(0, 20, 35_000_000);
const EARTH_CAMERA_ORIENTATION = { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 } as const;
const HELIO_CAMERA_ORIENTATION = { heading: 0, pitch: HELIO_CAMERA_PITCH, roll: 0 } as const;
const HELIO_PHASES = {
  earth: CesiumMath.toRadians(112),
  venus: CesiumMath.toRadians(28),
  mars: CesiumMath.toRadians(196)
} as const;
const HELIO_LABEL_OFFSET = new Cartesian2(16, 0);
const HELIO_CME_OFFSET = new Cartesian2(0, -16);
const EARTH_ONLY_LATITUDE = 18;
const EARTH_ONLY_HEIGHT = 35_000_000;
const EARTH_ONLY_ROTATION_DEGREES_PER_SECOND = 2.4;
const EARTH_ONLY_IDLE_DELAY_MS = 1800;

const AURORA_COLOR = Color.fromCssColorString("#00ff96");
const ORANGE_COLOR = Color.fromCssColorString("#ff6600");
const RED_COLOR = Color.fromCssColorString("#ff0000");

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const randomInRange = (min: number, max: number): number => min + Math.random() * (max - min);
const setVisibility = (items: Showable[], show: boolean): void => items.forEach((item) => { item.show = show; });
const toCallbackDate = (time?: JulianDate): Date => JulianDate.toDate(time ?? JulianDate.now());

const createArcPositions = (start: Cartesian3, end: Cartesian3, segments = 32): Cartesian3[] => {
  const startMag = Cartesian3.magnitude(start);
  const endMag = Cartesian3.magnitude(end);
  if (startMag < 1 || endMag < 1) return [start, end];
  const positions: Cartesian3[] = [];
  const startNorm = new Cartesian3(start.x / startMag, start.y / startMag, start.z / startMag);
  const endNorm = new Cartesian3(end.x / endMag, end.y / endMag, end.z / endMag);
  const dot = clamp(startNorm.x * endNorm.x + startNorm.y * endNorm.y + startNorm.z * endNorm.z, -1, 1);
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    let dirX: number;
    let dirY: number;
    let dirZ: number;
    if (sinOmega < 1e-6) {
      dirX = startNorm.x + (endNorm.x - startNorm.x) * t;
      dirY = startNorm.y + (endNorm.y - startNorm.y) * t;
      dirZ = startNorm.z + (endNorm.z - startNorm.z) * t;
    } else {
      const a = Math.sin((1 - t) * omega) / sinOmega;
      const b = Math.sin(t * omega) / sinOmega;
      dirX = a * startNorm.x + b * endNorm.x;
      dirY = a * startNorm.y + b * endNorm.y;
      dirZ = a * startNorm.z + b * endNorm.z;
    }
    const radius = startMag + (endMag - startMag) * t;
    const bow = 1 + 0.08 * Math.sin(t * Math.PI);
    const magnitude = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    const scale = magnitude > 0 ? (radius * bow) / magnitude : 0;
    positions.push(new Cartesian3(dirX * scale, dirY * scale, dirZ * scale));
  }

  return positions;
};

const computeSolarWindFrame = (time: JulianDate, earthR: number): SolarWindFrame => {
  const sunPos = Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time);
  const sunDir = Cartesian3.normalize(sunPos, new Cartesian3());
  const flowDir = Cartesian3.negate(sunDir, new Cartesian3());
  const spawnOrigin = Cartesian3.multiplyByScalar(sunDir, earthR * 25, new Cartesian3());
  const streamEnd = Cartesian3.multiplyByScalar(sunDir, -earthR * 8, new Cartesian3());
  const upVector = Math.abs(Cartesian3.dot(sunDir, Cartesian3.UNIT_Z)) > 0.95 ? Cartesian3.UNIT_Y : Cartesian3.UNIT_Z;
  const spreadAxisA = Cartesian3.normalize(Cartesian3.cross(sunDir, upVector, new Cartesian3()), new Cartesian3());
  const spreadAxisB = Cartesian3.normalize(Cartesian3.cross(sunDir, spreadAxisA, new Cartesian3()), new Cartesian3());
  return { sunDir, flowDir, spawnOrigin, streamEnd, spreadAxisA, spreadAxisB };
};

const setParticleOnSolarWindStream = (particle: SolarWindParticle, frame: SolarWindFrame, streamSpread: number, alongFlowOffset: number): void => {
  const spreadA = randomInRange(-streamSpread, streamSpread);
  const spreadB = randomInRange(-streamSpread, streamSpread);
  particle.x = frame.spawnOrigin.x + frame.flowDir.x * alongFlowOffset + frame.spreadAxisA.x * spreadA + frame.spreadAxisB.x * spreadB;
  particle.y = frame.spawnOrigin.y + frame.flowDir.y * alongFlowOffset + frame.spreadAxisA.y * spreadA + frame.spreadAxisB.y * spreadB;
  particle.z = frame.spawnOrigin.z + frame.flowDir.z * alongFlowOffset + frame.spreadAxisA.z * spreadA + frame.spreadAxisB.z * spreadB;
};

const isSatellitePickPayload = (value: unknown): value is SatellitePickPayload => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.type === "satellite" && typeof record.satellite === "object" && record.satellite !== null;
};

const createAuroraCapHierarchy = (isNorth: boolean, radiusDeg: number, pointCount = 96): PolygonHierarchy => {
  const positions: Cartesian3[] = [];
  const poleSign = isNorth ? 1 : -1;
  for (let index = 0; index <= pointCount; index += 1) {
    const theta = (index / pointCount) * CesiumMath.TWO_PI;
    const wobble = 1 + 0.12 * Math.sin(theta * 3);
    positions.push(Cartesian3.fromDegrees(CesiumMath.toDegrees(theta) - 180, poleSign * (90 - radiusDeg * wobble)));
  }
  return new PolygonHierarchy(positions);
};

const createAuroraMaterial = (minAlpha: number, maxAlpha: number, modeRef: { current: string }): ColorMaterialProperty =>
  new ColorMaterialProperty(new CallbackProperty(() => {
    const isStorm = modeRef.current === "STORM";
    const phase = 0.5 + 0.5 * Math.sin(performance.now() * (isStorm ? 0.004 : 0.0018));
    const baseMin = isStorm ? Math.min(minAlpha * 3, 0.6) : minAlpha;
    const baseMax = isStorm ? Math.min(maxAlpha * 2.5, 0.8) : maxAlpha;
    return AURORA_COLOR.withAlpha(baseMin + (baseMax - baseMin) * phase);
  }, false));

export const GlobeView = ({ satellites, conjunctions, spaceWeather }: GlobeViewProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setSelectedSatellite = useAuroraStore((state) => state.setSelectedSatellite);
  const currentModeRef = useRef(useAuroraStore.getState().currentMode);
  const earthOnlyRef = useRef(useAuroraStore.getState().earthOnlyMode);

  useEffect(() => {
    if (!containerRef.current) return;

    Ion.defaultAccessToken = env.VITE_CESIUM_ION_TOKEN;
    const viewer = new Viewer(containerRef.current, {
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
      scene3DOnly: true,
      msaaSamples: 4
    });

    viewer.scene.backgroundColor = Color.BLACK;
    viewer.scene.highDynamicRange = true;
    viewer.scene.globe.baseColor = Color.BLACK;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;

    const controller = viewer.scene.screenSpaceCameraController;
    controller.rotateEventTypes = [CameraEventType.LEFT_DRAG, CameraEventType.MIDDLE_DRAG];
    controller.translateEventTypes = [];
    controller.zoomEventTypes = [CameraEventType.WHEEL, CameraEventType.PINCH];
    controller.tiltEventTypes = CameraEventType.RIGHT_DRAG;
    controller.lookEventTypes = [];
    controller.zoomFactor = 2.0;
    controller.minimumZoomDistance = 25;
    controller.maximumZoomDistance = 200_000_000;

    viewer.camera.setView({ destination: EARTH_CAMERA_DESTINATION, orientation: EARTH_CAMERA_ORIENTATION });

    const earthObjects: Showable[] = [];
    const helioObjects: Showable[] = [];
    const registerEarth = <T extends Showable>(item: T): T => { earthObjects.push(item); return item; };
    const registerHelio = <T extends Showable>(item: T): T => { helioObjects.push(item); return item; };

    let isDisposed = false;
    let earthImageryLayer: Showable | null = null;
    let osmBuildingsTileset: Showable | null = null;
    let helioStartedAtMs = performance.now();
    let earthOnlyLastInteractionMs = performance.now();

    const applyModeVisibility = (mode: string): void => {
      const isEarthOnly = earthOnlyRef.current;
      const isHelio = mode === "HELIO";
      if (isEarthOnly) {
        setVisibility(earthObjects, false);
        setVisibility(helioObjects, false);
        selectedSatelliteRing.show = false;
        if (earthImageryLayer) earthImageryLayer.show = true;
        if (osmBuildingsTileset) osmBuildingsTileset.show = false;
        viewer.scene.globe.show = true;
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
        if (viewer.scene.sun) viewer.scene.sun.show = false;
        if (viewer.scene.moon) viewer.scene.moon.show = false;
        viewer.scene.globe.showGroundAtmosphere = false;
        controller.minimumZoomDistance = 25;
        controller.maximumZoomDistance = 200_000_000;
        return;
      }

      setVisibility(earthObjects, !isHelio);
      setVisibility(helioObjects, isHelio);
      if (isHelio) selectedSatelliteRing.show = false;
      if (earthImageryLayer) earthImageryLayer.show = !isHelio;
      if (osmBuildingsTileset) osmBuildingsTileset.show = !isHelio;
      viewer.scene.globe.show = !isHelio;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = !isHelio;
      if (viewer.scene.sun) viewer.scene.sun.show = !isHelio;
      if (viewer.scene.moon) viewer.scene.moon.show = !isHelio;
      viewer.scene.globe.showGroundAtmosphere = !isHelio;
      controller.minimumZoomDistance = isHelio ? HELIO_SUN_RADIUS * 0.45 : 25;
      controller.maximumZoomDistance = isHelio ? HELIO_AU_SCENE_UNITS * 6 : 200_000_000;
    };

    const flyCameraToEarthOnly = (): void => {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(0, EARTH_ONLY_LATITUDE, EARTH_ONLY_HEIGHT),
        orientation: EARTH_CAMERA_ORIENTATION,
        duration: 1.2,
        easingFunction: EasingFunction.QUADRATIC_OUT
      });
    };

    const markEarthOnlyInteraction = (): void => {
      earthOnlyLastInteractionMs = performance.now();
    };

    const transitionCameraForMode = (mode: string, previousMode?: string): void => {
      if (earthOnlyRef.current) return;
      if (mode === "HELIO") {
        viewer.camera.flyTo({
          destination: HELIO_CAMERA_DESTINATION,
          orientation: HELIO_CAMERA_ORIENTATION,
          duration: 1.8,
          easingFunction: EasingFunction.QUADRATIC_IN_OUT
        });
      } else if (previousMode === "HELIO") {
        viewer.camera.flyTo({
          destination: EARTH_CAMERA_DESTINATION,
          orientation: EARTH_CAMERA_ORIENTATION,
          duration: 1.5,
          easingFunction: EasingFunction.QUADRATIC_OUT
        });
      }
    };

    createWorldTerrainAsync({ requestWaterMask: true, requestVertexNormals: true }).then((terrainProvider) => {
      if (!isDisposed && !viewer.isDestroyed()) viewer.terrainProvider = terrainProvider;
    }).catch((err) => console.error("[AURORA] Failed to load terrain", err));

    IonImageryProvider.fromAssetId(2).then((provider) => {
      if (isDisposed || viewer.isDestroyed()) return;
      const layer = viewer.imageryLayers.addImageryProvider(provider);
      earthImageryLayer = layer;
      layer.show = currentModeRef.current !== "HELIO";
    }).catch((err) => console.error("[AURORA] Failed to load imagery", err));

    createOsmBuildingsAsync().then((tileset) => {
      if (isDisposed || viewer.isDestroyed()) return;
      viewer.scene.primitives.add(tileset);
      osmBuildingsTileset = tileset;
      tileset.show = currentModeRef.current !== "HELIO";
    }).catch((err) => console.error("[AURORA] Failed to load OSM buildings", err));

    const earthR = earthRadiusMeters;
    const satellitePoints = registerEarth(viewer.scene.primitives.add(new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE_AND_TRANSLUCENT })));
    const criticalPoints: PointPrimitive[] = [];
    const satAnimStates: SatelliteAnimState[] = [];
    const satAnimByNorad = new Map<number, SatelliteAnimState>();
    let selectedSatelliteNoradId = useAuroraStore.getState().selectedSatellite?.noradId ?? null;
    let selectedConjunctionId = useAuroraStore.getState().selectedConjunction?.id ?? null;

    satellites.forEach((satellite) => {
      const { radius, inclination, ascendingNode } = getOrbitParams(satellite);
      const state: SatelliteAnimState = {
        point: satellitePoints.add({
          position: orbitPoint(CesiumMath.toRadians(satellite.lon + 180), radius, inclination, ascendingNode),
          pixelSize: satellite.riskLevel === "critical" ? 10 : 6,
          color: riskColorMap[satellite.riskLevel].clone(),
          outlineColor: Color.WHITE.withAlpha(0.25),
          outlineWidth: satellite.riskLevel === "critical" ? 2 : 1,
          disableDepthTestDistance: 0.0,
          id: { type: "satellite", satellite }
        }),
        satellite,
        radius,
        inclination,
        ascendingNode,
        period: getOrbitalPeriod(radius),
        initialTheta: CesiumMath.toRadians(satellite.lon + 180)
      };
      satAnimStates.push(state);
      satAnimByNorad.set(satellite.noradId, state);
      if (satellite.riskLevel === "critical") criticalPoints.push(state.point);
    });

    const flyCameraToSatellite = (noradId: number): void => {
      if (currentModeRef.current === "HELIO") return;
      const state = satAnimByNorad.get(noradId);
      if (!state) return;
      const radialDirection = Cartesian3.normalize(state.point.position, new Cartesian3());
      const offset = Cartesian3.multiplyByScalar(radialDirection, earthR * 2.5, new Cartesian3());
      viewer.camera.flyTo({
        destination: Cartesian3.add(state.point.position, offset, new Cartesian3()),
        duration: 1.25,
        easingFunction: EasingFunction.QUADRATIC_OUT
      });
    };

    const selectedRingPosition = new Cartesian3(earthR, 0, 0);
    const selectedSatelliteRing = viewer.entities.add({
      show: false,
      position: new CallbackPositionProperty(() => selectedRingPosition, false),
      ellipse: {
        semiMajorAxis: 260_000,
        semiMinorAxis: 260_000,
        material: Color.TRANSPARENT,
        outline: true,
        outlineColor: Color.fromCssColorString("#00d4ff"),
        outlineWidth: 2
      }
    });

    if (selectedSatelliteNoradId !== null && currentModeRef.current !== "HELIO") flyCameraToSatellite(selectedSatelliteNoradId);

    registerEarth(viewer.scene.primitives.add(new Primitive({
      geometryInstances: satellites.map((satellite) => new GeometryInstance({
        geometry: new PolylineGeometry({
          positions: createOrbitPositions(satellite),
          width: 1,
          vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT
        })
      })),
      appearance: new PolylineMaterialAppearance({
        material: Material.fromType("PolylineDash", {
          color: Color.fromCssColorString("#00d4ff").withAlpha(0.18),
          gapColor: Color.TRANSPARENT,
          dashLength: 24,
          dashPattern: 255
        })
      }),
      asynchronous: false
    })));

    const conjunctionLines = registerEarth(viewer.scene.primitives.add(new PolylineCollection()));
    const conjunctionLineState: ConjunctionLineState[] = [];
    conjunctions.forEach((conjunction) => {
      const first = satAnimByNorad.get(conjunction.object1.noradId);
      const second = satAnimByNorad.get(conjunction.object2.noradId);
      if (!first || !second) return;
      conjunctionLineState.push({
        conjunction,
        sat1NoradId: conjunction.object1.noradId,
        sat2NoradId: conjunction.object2.noradId,
        polyline: conjunctionLines.add({
          positions: [first.point.position, second.point.position],
          show: false,
          width: 2,
          material: Material.fromType("Color", { color: ORANGE_COLOR.withAlpha(0.8) })
        })
      });
    });

    const auroraRadiusDeg = kpToAuroraRadiusDegrees(spaceWeather.kpIndex);
    [createAuroraCapHierarchy(true, auroraRadiusDeg), createAuroraCapHierarchy(true, auroraRadiusDeg * 0.68), createAuroraCapHierarchy(false, auroraRadiusDeg), createAuroraCapHierarchy(false, auroraRadiusDeg * 0.68)]
      .forEach((hierarchy, index) => {
        registerEarth(viewer.entities.add({
          polygon: {
            hierarchy,
            material: createAuroraMaterial(index % 2 === 0 ? 0.07 : 0.17, index % 2 === 0 ? 0.16 : 0.35, currentModeRef),
            perPositionHeight: false
          }
        }));
      });

    registerEarth(viewer.scene.primitives.add(new Primitive({
      geometryInstances: new GeometryInstance({
        geometry: new EllipsoidGeometry({
          radii: new Cartesian3(earthR * 9, earthR * 10, earthR * 10),
          vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
          stackPartitions: 64,
          slicePartitions: 64
        }),
        attributes: { color: ColorGeometryInstanceAttribute.fromColor(new Color(100 / 255, 180 / 255, 1, 0.06)) }
      }),
      appearance: new PerInstanceColorAppearance({ translucent: true, closed: true }),
      modelMatrix: Matrix4.fromTranslation(new Cartesian3(earthR, 0, 0)),
      asynchronous: false,
      allowPicking: false
    })));

    const solarWindColor = getSolarWindColor(spaceWeather.solarWindSpeed);
    const particleCollection = registerEarth(viewer.scene.primitives.add(new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE_AND_TRANSLUCENT })));
    const particles: SolarWindParticle[] = [];
    const streamSpread = earthR * 6;
    const initialWindFrame = computeSolarWindFrame(JulianDate.now(), earthR);

    for (let index = 0; index < 200; index += 1) {
      const particle: SolarWindParticle = {
        primitive: particleCollection.add({
          position: new Cartesian3(),
          pixelSize: randomInRange(1.5, 3.5),
          color: solarWindColor.withAlpha(randomInRange(0.35, 0.8)),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }),
        x: 0,
        y: 0,
        z: 0,
        speedScale: randomInRange(0.8, 1.25)
      };
      setParticleOnSolarWindStream(particle, initialWindFrame, streamSpread, 0);
      particle.primitive.position = new Cartesian3(particle.x, particle.y, particle.z);
      particles.push(particle);
    }

    [
      viewer.entities.add({
        position: Cartesian3.ZERO,
        ellipsoid: {
          radii: new Cartesian3(HELIO_SUN_GLOW_RADIUS, HELIO_SUN_GLOW_RADIUS, HELIO_SUN_GLOW_RADIUS),
          material: Color.fromCssColorString("#ffb347").withAlpha(0.12)
        }
      }),
      viewer.entities.add({
        position: Cartesian3.ZERO,
        ellipsoid: {
          radii: new Cartesian3(HELIO_SUN_RADIUS, HELIO_SUN_RADIUS, HELIO_SUN_RADIUS),
          material: Color.fromCssColorString("#ffe694").withAlpha(0.96)
        },
        label: {
          text: "Sun",
          font: "11px 'JetBrains Mono', monospace",
          fillColor: Color.fromCssColorString("#ffe8ab"),
          showBackground: true,
          backgroundColor: Color.fromCssColorString("#2b1800").withAlpha(0.72),
          pixelOffset: new Cartesian2(0, 24),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      }),
      viewer.entities.add({ polyline: { positions: createOrbitRingPositions(HELIO_ORBIT_RADII.venus), width: 1.2, material: Color.fromCssColorString("#dcc28a").withAlpha(0.22) } }),
      viewer.entities.add({ polyline: { positions: createOrbitRingPositions(HELIO_ORBIT_RADII.earth), width: 1.4, material: Color.fromCssColorString("#46a2ff").withAlpha(0.26) } }),
      viewer.entities.add({ polyline: { positions: createOrbitRingPositions(HELIO_ORBIT_RADII.mars), width: 1.2, material: Color.fromCssColorString("#e27c55").withAlpha(0.2) } })
    ].forEach((entity) => registerHelio(entity));

    [
      { start: HELIO_ORBIT_RADII.earth * 0.18, end: HELIO_ORBIT_RADII.earth * 1.02, width: HELIO_AU_SCENE_UNITS * 0.26, color: Color.fromCssColorString("#ffb347").withAlpha(0.05) },
      { start: HELIO_ORBIT_RADII.earth * 0.24, end: HELIO_ORBIT_RADII.earth * 0.95, width: HELIO_AU_SCENE_UNITS * 0.18, color: Color.fromCssColorString("#ff7a2a").withAlpha(0.08) },
      { start: HELIO_ORBIT_RADII.earth * 0.32, end: HELIO_ORBIT_RADII.earth * 0.86, width: HELIO_AU_SCENE_UNITS * 0.11, color: Color.fromCssColorString("#ff4f1f").withAlpha(0.11) }
    ].forEach((band) => registerHelio(viewer.entities.add({
      polygon: {
        hierarchy: new CallbackProperty((time) => {
          const earthAngle = getHelioOrbitAngle(toCallbackDate(time), 365.25, HELIO_PHASES.earth);
          return createHelioBandHierarchy(earthAngle, band.start, band.end, band.width);
        }, false),
        material: band.color,
        perPositionHeight: true
      }
    })));

    registerHelio(viewer.entities.add({
      position: new CallbackPositionProperty((time, result) => positionOnHelioOrbit(HELIO_ORBIT_RADII.earth, getHelioOrbitAngle(toCallbackDate(time), 365.25, HELIO_PHASES.earth), result), false),
      point: {
        pixelSize: 12,
        color: Color.fromCssColorString("#46a2ff"),
        outlineColor: Color.WHITE.withAlpha(0.9),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: "Earth",
        font: "12px 'JetBrains Mono', monospace",
        fillColor: Color.fromCssColorString("#9fd0ff"),
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#071826").withAlpha(0.72),
        pixelOffset: HELIO_LABEL_OFFSET,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    }));

    registerHelio(viewer.entities.add({
      position: new CallbackPositionProperty((time, result) => positionOnHelioOrbit(HELIO_ORBIT_RADII.venus, getHelioOrbitAngle(toCallbackDate(time), 224.7, HELIO_PHASES.venus), result), false),
      point: {
        pixelSize: 8,
        color: Color.fromCssColorString("#dcc28a"),
        outlineColor: Color.WHITE.withAlpha(0.45),
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: "Venus",
        font: "10px 'JetBrains Mono', monospace",
        fillColor: Color.fromCssColorString("#dcc28a"),
        pixelOffset: new Cartesian2(14, -10),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    }));

    registerHelio(viewer.entities.add({
      position: new CallbackPositionProperty((time, result) => positionOnHelioOrbit(HELIO_ORBIT_RADII.mars, getHelioOrbitAngle(toCallbackDate(time), 687, HELIO_PHASES.mars), result), false),
      point: {
        pixelSize: 8,
        color: Color.fromCssColorString("#e27c55"),
        outlineColor: Color.WHITE.withAlpha(0.45),
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: "Mars",
        font: "10px 'JetBrains Mono', monospace",
        fillColor: Color.fromCssColorString("#e27c55"),
        pixelOffset: new Cartesian2(14, 10),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    }));

    registerHelio(viewer.entities.add({
      position: new CallbackPositionProperty((time, result) => positionOnHelioOrbit(HELIO_ORBIT_RADII.earth - HELIO_L1_OFFSET, getHelioOrbitAngle(toCallbackDate(time), 365.25, HELIO_PHASES.earth), result), false),
      point: {
        pixelSize: 7,
        color: Color.fromCssColorString("#00d4ff"),
        outlineColor: Color.WHITE.withAlpha(0.35),
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: "L1 - DSCOVR (Early Warning)",
        font: "11px 'JetBrains Mono', monospace",
        fillColor: Color.fromCssColorString("#00d4ff"),
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#051624").withAlpha(0.74),
        pixelOffset: new Cartesian2(18, 0),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    }));

    registerHelio(viewer.entities.add({
      polygon: {
        hierarchy: new CallbackProperty((time) => {
          const radius = Math.max(getHelioCmeRadius((performance.now() - helioStartedAtMs) / 1000), HELIO_SUN_RADIUS * 1.2);
          return createSectorHierarchy(radius, getHelioOrbitAngle(toCallbackDate(time), 365.25, HELIO_PHASES.earth), HELIO_CME_HALF_ANGLE);
        }, false),
        material: new ColorMaterialProperty(new CallbackProperty(() => {
          const pulse = 0.14 + 0.08 * (0.5 + 0.5 * Math.sin(performance.now() * 0.0034));
          return Color.fromCssColorString("#ff5e1f").withAlpha(pulse);
        }, false)),
        perPositionHeight: true
      }
    }));

    registerHelio(viewer.entities.add({
      polyline: {
        positions: new CallbackProperty((time) => {
          const radius = Math.max(getHelioCmeRadius((performance.now() - helioStartedAtMs) / 1000), HELIO_SUN_RADIUS * 1.2);
          return createOrbitArcPositions(radius, getHelioOrbitAngle(toCallbackDate(time), 365.25, HELIO_PHASES.earth), HELIO_CME_HALF_ANGLE, 40);
        }, false),
        width: 3,
        material: Color.fromCssColorString("#ff9b4a").withAlpha(0.72)
      }
    }));

    registerHelio(viewer.entities.add({
      position: new CallbackPositionProperty((time, result) => {
        const radius = getHelioCmeRadius((performance.now() - helioStartedAtMs) / 1000);
        return positionOnHelioOrbit(Math.max(radius + HELIO_AU_SCENE_UNITS * 0.08, HELIO_SUN_RADIUS * 2), getHelioOrbitAngle(toCallbackDate(time), 365.25, HELIO_PHASES.earth), result);
      }, false),
      label: {
        text: new CallbackProperty(() => `ESTIMATED ARRIVAL: ${formatHelioArrivalLabel((performance.now() - helioStartedAtMs) / 1000)}`, false),
        font: "11px 'JetBrains Mono', monospace",
        fillColor: Color.fromCssColorString("#ffbf78"),
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#2a1100").withAlpha(0.8),
        pixelOffset: HELIO_CME_OFFSET,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    }));

    let lastFrameMs = performance.now();
    const startTimeMs = performance.now();
    const onPreRender = (_scene: unknown, time: JulianDate): void => {
      const nowMs = performance.now();
      const deltaSeconds = Math.min((nowMs - lastFrameMs) / 1000, 0.12);
      lastFrameMs = nowMs;
      const timeSeconds = JulianDate.toDate(time).getTime() / 1000;
      const elapsedSeconds = (nowMs - startTimeMs) / 1000;

      satAnimStates.forEach((state) => {
        const theta = state.initialTheta + (CesiumMath.TWO_PI / state.period) * elapsedSeconds;
        state.point.position = orbitPoint(theta, state.radius, state.inclination, state.ascendingNode);
      });

      if (earthOnlyRef.current || currentModeRef.current === "HELIO") {
        selectedSatelliteRing.show = false;
      } else if (selectedSatelliteNoradId !== null) {
        const selected = satAnimByNorad.get(selectedSatelliteNoradId);
        selectedSatelliteRing.show = Boolean(selected);
        if (selected) Cartesian3.clone(selected.point.position, selectedRingPosition);
      } else {
        selectedSatelliteRing.show = false;
      }

      conjunctionLineState.forEach((lineState) => {
        const s1 = satAnimByNorad.get(lineState.sat1NoradId);
        const s2 = satAnimByNorad.get(lineState.sat2NoradId);
        if (!s1 || !s2) return;
        const dist = Cartesian3.distance(s1.point.position, s2.point.position);
        const isSelected = selectedConjunctionId === lineState.conjunction.id;
        if (dist > earthR * 3 && !isSelected) {
          lineState.polyline.show = false;
          return;
        }
        lineState.polyline.show = true;
        lineState.polyline.width = isSelected ? 3 : 2;
        lineState.polyline.positions = createArcPositions(s1.point.position, s2.point.position);
        const urgency = clamp((6 - (lineState.conjunction.tca.getTime() - Date.now()) / 3_600_000) / 6, 0, 1);
        const color = Color.lerp(ORANGE_COLOR, RED_COLOR, urgency, new Color());
        color.alpha = isSelected ? 1 : 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(timeSeconds * Math.PI));
        (lineState.polyline.material.uniforms as { color: Color }).color = color;
      });

      const criticalPulse = 0.5 + 0.5 * Math.sin(timeSeconds * 4.5);
      criticalPoints.forEach((point) => {
        point.pixelSize = 10 + criticalPulse * 2;
        point.color = RED_COLOR.withAlpha(0.7 + criticalPulse * 0.3);
      });

      const isStormMode = currentModeRef.current === "STORM" || spaceWeather.kpIndex > 5;
      const flowSpeed = spaceWeather.solarWindSpeed * 18_000 * (isStormMode ? 2 : 1);
      particles.forEach((particle) => {
        particle.primitive.color = (isStormMode ? RED_COLOR : solarWindColor).withAlpha(randomInRange(isStormMode ? 0.5 : 0.35, isStormMode ? 0.9 : 0.8));
      });

      const windFrame = computeSolarWindFrame(time, earthR);
      const streamEndProjection = windFrame.streamEnd.x * windFrame.sunDir.x + windFrame.streamEnd.y * windFrame.sunDir.y + windFrame.streamEnd.z * windFrame.sunDir.z;
      const shieldRadiusYZ = earthR * 10;
      const shieldRadiusX = earthR * 9;
      const shieldCenterX = earthR;

      particles.forEach((particle, index) => {
        const travelStep = flowSpeed * particle.speedScale * deltaSeconds;
        particle.x += windFrame.flowDir.x * travelStep;
        particle.y += windFrame.flowDir.y * travelStep + Math.sin((timeSeconds + index) * 0.7) * 200 * deltaSeconds;
        particle.z += windFrame.flowDir.z * travelStep + Math.cos((timeSeconds + index) * 0.5) * 200 * deltaSeconds;
        const dx = particle.x - shieldCenterX;
        const ellipsoidDist =
          (dx * dx) / (shieldRadiusX * shieldRadiusX) +
          (particle.y * particle.y) / (shieldRadiusYZ * shieldRadiusYZ) +
          (particle.z * particle.z) / (shieldRadiusYZ * shieldRadiusYZ);

        if (ellipsoidDist < 1) {
          const lateralDist = Math.sqrt(particle.y * particle.y + particle.z * particle.z);
          if (lateralDist < 1) {
            const angle = randomInRange(0, CesiumMath.TWO_PI);
            particle.y += Math.cos(angle) * earthR * 0.5;
            particle.z += Math.sin(angle) * earthR * 0.5;
          } else {
            const deflectStrength = flowSpeed * particle.speedScale * deltaSeconds * 2.5;
            particle.y += (particle.y / lateralDist) * deflectStrength;
            particle.z += (particle.z / lateralDist) * deflectStrength;
          }
          particle.x += flowSpeed * particle.speedScale * deltaSeconds * 0.4;
        }

        const axisProjection = particle.x * windFrame.sunDir.x + particle.y * windFrame.sunDir.y + particle.z * windFrame.sunDir.z;
        if (axisProjection < streamEndProjection) setParticleOnSolarWindStream(particle, windFrame, streamSpread, 0);
        particle.primitive.position = new Cartesian3(particle.x, particle.y, particle.z);
      });

      if (earthOnlyRef.current) {
        const isIdle = nowMs - earthOnlyLastInteractionMs > EARTH_ONLY_IDLE_DELAY_MS;
        if (isIdle) {
          viewer.camera.rotate(Cartesian3.UNIT_Z, CesiumMath.toRadians(EARTH_ONLY_ROTATION_DEGREES_PER_SECOND) * deltaSeconds);
        }
      }
    };

    const unsubscribeStore = useAuroraStore.subscribe((state, previousState) => {
      currentModeRef.current = state.currentMode;
      earthOnlyRef.current = state.earthOnlyMode;

      if (state.earthOnlyMode !== previousState.earthOnlyMode) {
        applyModeVisibility(state.currentMode);
        if (state.earthOnlyMode) {
          earthOnlyLastInteractionMs = performance.now();
          flyCameraToEarthOnly();
        } else if (state.currentMode === "HELIO") {
          helioStartedAtMs = performance.now();
          transitionCameraForMode("HELIO");
        } else {
          viewer.camera.flyTo({
            destination: EARTH_CAMERA_DESTINATION,
            orientation: EARTH_CAMERA_ORIENTATION,
            duration: 1.1,
            easingFunction: EasingFunction.QUADRATIC_OUT
          });
        }
      }

      if (state.currentMode !== previousState.currentMode) {
        if (state.currentMode === "HELIO" && previousState.currentMode !== "HELIO") helioStartedAtMs = performance.now();
        applyModeVisibility(state.currentMode);
        if (!state.earthOnlyMode) {
          transitionCameraForMode(state.currentMode, previousState.currentMode);
        }
      }

      const nextSatelliteNorad = state.selectedSatellite?.noradId ?? null;
      const previousSatelliteNorad = previousState.selectedSatellite?.noradId ?? null;
      if (nextSatelliteNorad !== previousSatelliteNorad) {
        selectedSatelliteNoradId = nextSatelliteNorad;
        if (nextSatelliteNorad !== null && state.currentMode !== "HELIO" && !state.earthOnlyMode) {
          flyCameraToSatellite(nextSatelliteNorad);
        }
      }

      selectedConjunctionId = state.selectedConjunction?.id ?? null;
    });

    applyModeVisibility(currentModeRef.current);
    if (earthOnlyRef.current) {
      earthOnlyLastInteractionMs = performance.now();
      flyCameraToEarthOnly();
    } else if (currentModeRef.current === "HELIO") {
      helioStartedAtMs = performance.now();
      transitionCameraForMode("HELIO");
    }

    viewer.scene.preRender.addEventListener(onPreRender);
    viewer.canvas.addEventListener("pointerdown", markEarthOnlyInteraction);
    viewer.canvas.addEventListener("wheel", markEarthOnlyInteraction, { passive: true });
    viewer.canvas.addEventListener("touchstart", markEarthOnlyInteraction, { passive: true });
    viewer.canvas.addEventListener("touchmove", markEarthOnlyInteraction, { passive: true });
    const onPointerMove = (event: PointerEvent): void => {
      if (event.buttons > 0) {
        markEarthOnlyInteraction();
      }
    };
    viewer.canvas.addEventListener("pointermove", onPointerMove);
    let mouseDownPosition = { x: 0, y: 0 };
    viewer.screenSpaceEventHandler.setInputAction((event: { position: Cartesian2 }) => {
      mouseDownPosition = { x: event.position.x, y: event.position.y };
    }, ScreenSpaceEventType.LEFT_DOWN);

    viewer.screenSpaceEventHandler.setInputAction((event: { position: Cartesian2 }) => {
      const dx = event.position.x - mouseDownPosition.x;
      const dy = event.position.y - mouseDownPosition.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;
      const picked = viewer.scene.pick(event.position);
      if (!defined(picked)) return;
      const pickedWithId = picked as { id?: unknown };
      if (!isSatellitePickPayload(pickedWithId.id)) return;
      setSelectedSatellite(pickedWithId.id.satellite);
    }, ScreenSpaceEventType.LEFT_UP);

    return () => {
      isDisposed = true;
      viewer.scene.preRender.removeEventListener(onPreRender);
      viewer.canvas.removeEventListener("pointerdown", markEarthOnlyInteraction);
      viewer.canvas.removeEventListener("wheel", markEarthOnlyInteraction);
      viewer.canvas.removeEventListener("touchstart", markEarthOnlyInteraction);
      viewer.canvas.removeEventListener("touchmove", markEarthOnlyInteraction);
      viewer.canvas.removeEventListener("pointermove", onPointerMove);
      viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOWN);
      viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_UP);
      unsubscribeStore();
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, [conjunctions, satellites, setSelectedSatellite, spaceWeather]);

  return <div ref={containerRef} className="h-full w-full" />;
};
