import { installEarth } from "../earth/scene";
import { useEarth } from "../earth/store";
import { useExplorer, type PickChoice } from "../explorer/store";
import { detachAerospaceCamera, useAerospace } from "../aerospace/store";
import { installCatalogModels, catalogModelKind } from "./scene/catalogModels";
import { installAerospace } from "../aerospace/scene";
import {
  BlendOption,
  Billboard, BillboardCollection, NearFarScalar,
  buildModuleUrl,
  GeographicTilingScheme,
  UrlTemplateImageryProvider,
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
  ImageMaterialProperty,
  Ion,
  IonImageryProvider,
  JulianDate,
  LabelCollection,
  Material,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  PerInstanceColorAppearance,
  PointPrimitive,
  PointPrimitiveCollection,
  PolygonHierarchy,
  PolylineDashMaterialProperty,
  PolylineGlowMaterialProperty,
  PolylineCollection,
  Primitive,
  ScreenSpaceEventType,
  Simon1994PlanetaryPositions,
  Viewer
} from "cesium";
import { useEffect, useRef } from "react";
import { gstime } from "satellite.js";

import { useAuroraStore } from "../store/auroraStore";
import type { ConjunctionWarning, Satellite, SpaceWeather } from "../types/space";
import { getSolarWindColor } from "../utils/colors";
import { conjunctionArcLineWidth, resolveConjunctionRiskLevel } from "../utils/conjunctionRisk";
import { conjunctionObjectLabel, conjunctionPairStyle, orderedConjunctionPairs } from "../utils/conjunctionPairs";
import { formatDurationToTca } from "../utils/format";
import {
  createOrbitArcPositions,
  createOrbitRingPositions,
  formatHelioArrivalLabel,
  getHelioCmeProgress,
  HELIO_CME_DURATION_SECONDS,
  HELIO_CME_PROGRESS_END,
  HELIO_CME_PROGRESS_START,
  getHelioOrbitAngle,
  HELIO_AU_SCENE_UNITS,
  HELIO_L1_OFFSET,
  HELIO_ORBIT_RADII,
  HELIO_SUN_RADIUS,
  positionOnHelioOrbit
} from "../utils/helio";
import { env, hasValidCesiumIonToken } from "../utils/env";
import { enhanceScene } from "./scene/enhanceScene";
import { useSceneStore } from "../store/sceneStore";
import { propagatedPosition, hasCurrentElements, predictedOrbit, orbitalElements } from "../utils/propagation";
import { satelliteSnapshotPosition } from "../utils/satellitePosition";
import type { CatalogWindow } from "../utils/catalogPropagation";
import { objectClassification } from "../utils/objectType";
import { clamp } from "../utils/clamp";
import { GlobeOcclusion } from "../utils/globeOcclusion";
import { createBezierArcPositions } from "../utils/curves";
import { auroraRibbon, auroraCurtainTexture } from "../utils/auroraVisual";
import { createFireConeFrontPositions } from "../utils/cmeFlameCone";
import { createOrbitPositions, earthRadiusMeters, getOrbitalPeriod, getOrbitParams, kpToAuroraRadiusDegrees, orbitPoint, orbitThetaAtElapsed } from "../utils/orbit";
import type { SatelliteOrbitAnim } from "../utils/satelliteOrbitAnim";
import { createConjunctionOrbitArcPositions, getSatellitePositionAtOffset } from "../utils/satelliteOrbitAnim";
import { isStormModeActive } from "../utils/visualMode";

interface GlobeViewProps {
  satellites: Satellite[];
  conjunctions: ConjunctionWarning[];
  spaceWeather: SpaceWeather;
}

interface SatellitePickPayload {
  type: "satellite";
  satellite: Satellite;
}

interface SatelliteAnimState extends SatelliteOrbitAnim {
  point: Billboard;
  positionScratch: Cartesian3;
  catalogColor: Color;
  satellite: Satellite;
}

interface ConjunctionVisualState {
  conjunction: ConjunctionWarning;
  pairNumber: string;
  pairColor: Color;
  riskLevel: Satellite["riskLevel"];
  object1Arc: ReturnType<PolylineCollection["add"]>;
  object2Arc: ReturnType<PolylineCollection["add"]>;
  missDistanceLine: ReturnType<PolylineCollection["add"]>;
  marker: PointPrimitive;
  label: ReturnType<LabelCollection["add"]>;
  object2Marker: PointPrimitive;
  object2Label: ReturnType<LabelCollection["add"]>;
  sat1NoradId: number;
  sat2NoradId: number;
  orbitCache?: {
    minute: number;
    object1Elements: ReturnType<typeof orbitalElements>;
    object2Elements: ReturnType<typeof orbitalElements>;
  };
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

interface HelioCmeEmberState {
  primitive: PointPrimitive;
  progressOffset: number;
  lateralBias: number;
  liftBias: number;
  speedScale: number;
  alpha: number;
  size: number;
}

interface HelioDensityParticleState {
  primitive: PointPrimitive;
  distanceOffset: number;
  lateralBias: number;
  verticalBias: number;
  alpha: number;
  size: number;
}

type Showable = { show: boolean };

const EARTH_CAMERA_DESTINATION = Cartesian3.fromDegrees(0, 20, 35_000_000);
const EARTH_CAMERA_ORIENTATION = { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 } as const;
const HELIO_PHASES = {
  earth: 0,
  venus: CesiumMath.toRadians(28),
  mars: CesiumMath.toRadians(196)
} as const;
const HELIO_CAMERA_DESTINATION_VISUAL = new Cartesian3(
  -HELIO_AU_SCENE_UNITS * 1.9,
  -HELIO_AU_SCENE_UNITS * 0.72,
  HELIO_AU_SCENE_UNITS * 0.98
);
const HELIO_CAMERA_TARGET = new Cartesian3(
  HELIO_AU_SCENE_UNITS * 0.16,
  HELIO_AU_SCENE_UNITS * 0.08,
  0
);
const HELIO_CAMERA_DIRECTION = Cartesian3.normalize(
  Cartesian3.subtract(HELIO_CAMERA_TARGET, HELIO_CAMERA_DESTINATION_VISUAL, new Cartesian3()),
  new Cartesian3()
);
const HELIO_CME_OFFSET = new Cartesian2(0, -16);
const EARTH_ONLY_LATITUDE = 18;
const EARTH_ONLY_HEIGHT = 35_000_000;
const EARTH_ONLY_ROTATION_DEGREES_PER_SECOND = 2.4;
const EARTH_ONLY_IDLE_DELAY_MS = 1800;
const HELIO_VISUAL_SUN_RADIUS = HELIO_SUN_RADIUS * 1.4;
const HELIO_CME_VISUAL_HALF_ANGLE = CesiumMath.toRadians(25);
const HELIO_ORBIT_TIME_SCALE_SECONDS = 12 * 3600;
const HELIO_PLAYBACK_BASE_RATE = 1;
const HELIO_ORBIT_DASH_PATTERN = Number.parseInt("1111111100000000", 2);
const HELIO_SIM_SYNC_INTERVAL_MS = 120;
const HELIO_PLANET_RADII = {
  earth: 360_000,
  venus: 320_000,
  mars: 290_000
} as const;

const RED_COLOR = Color.fromCssColorString("#ff0000");

const randomInRange = (min: number, max: number): number => min + Math.random() * (max - min);
const setVisibility = (items: Showable[], show: boolean): void => items.forEach((item) => { item.show = show; });
const toCallbackDate = (time?: JulianDate): Date => JulianDate.toDate(time ?? JulianDate.now());

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

const createMutableFlameFront = (count: number): Cartesian3[] => Array.from({ length: count }, () => new Cartesian3());

const createDiamondMarkerImage = (): string => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return "";

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(32, 32);

  context.shadowBlur = 18;
  context.shadowColor = "rgba(0,255,255,0.95)";
  context.fillStyle = "rgba(0,255,255,0.95)";
  context.strokeStyle = "rgba(255,255,255,0.9)";
  context.lineWidth = 2;

  context.beginPath();
  context.moveTo(0, -18);
  context.lineTo(18, 0);
  context.lineTo(0, 18);
  context.lineTo(-18, 0);
  context.closePath();
  context.fill();
  context.stroke();

  context.shadowBlur = 10;
  context.beginPath();
  context.moveTo(-22, 0);
  context.lineTo(22, 0);
  context.moveTo(0, -22);
  context.lineTo(0, 22);
  context.stroke();

  return canvas.toDataURL("image/png");
};

const createPlanetTexture = (planet: "earth" | "venus" | "mars"): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const drawBands = (colors: string[], blur: number, alpha = 1): void => {
    context.save();
    context.globalAlpha = alpha;
    context.filter = `blur(${blur}px)`;
    colors.forEach((color, index) => {
      context.fillStyle = color;
      context.fillRect(0, (index / colors.length) * canvas.height, canvas.width, canvas.height / colors.length + 28);
    });
    context.restore();
  };

  const drawBlobs = (count: number, minRadius: number, maxRadius: number, color: string, alpha: number): void => {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = color;
    for (let index = 0; index < count; index += 1) {
      const x = randomInRange(0, canvas.width);
      const y = randomInRange(0, canvas.height);
      const radiusX = randomInRange(minRadius, maxRadius);
      const radiusY = randomInRange(minRadius * 0.4, maxRadius * 0.75);
      context.beginPath();
      context.ellipse(x, y, radiusX, radiusY, randomInRange(0, Math.PI), 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  };

  if (planet === "earth") {
    const ocean = context.createLinearGradient(0, 0, 0, canvas.height);
    ocean.addColorStop(0, "#173f8d");
    ocean.addColorStop(0.55, "#0c2458");
    ocean.addColorStop(1, "#071831");
    context.fillStyle = ocean;
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawBlobs(24, 44, 110, "#2da05e", 0.9);
    drawBlobs(16, 20, 70, "#c7bb6e", 0.24);
    drawBands(["rgba(255,255,255,0.18)", "rgba(190,220,255,0.08)", "rgba(255,255,255,0.14)"], 18, 0.9);
    context.save();
    context.strokeStyle = "rgba(120,180,255,0.12)";
    context.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 64) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 64) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
    context.restore();
  }

  if (planet === "venus") {
    const haze = context.createLinearGradient(0, 0, 0, canvas.height);
    haze.addColorStop(0, "#e9d49d");
    haze.addColorStop(0.45, "#c59a52");
    haze.addColorStop(1, "#8f5926");
    context.fillStyle = haze;
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawBands(["rgba(255,245,220,0.16)", "rgba(255,196,110,0.12)", "rgba(155,88,30,0.08)"], 22, 1);
    drawBlobs(34, 40, 120, "#f5deb3", 0.18);
  }

  if (planet === "mars") {
    const dust = context.createLinearGradient(0, 0, 0, canvas.height);
    dust.addColorStop(0, "#d88958");
    dust.addColorStop(0.55, "#a2492c");
    dust.addColorStop(1, "#5f2318");
    context.fillStyle = dust;
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawBlobs(26, 28, 90, "#7b2a19", 0.34);
    drawBlobs(12, 36, 120, "#f0d3bc", 0.08);
    context.fillStyle = "rgba(255,245,230,0.45)";
    context.beginPath();
    context.ellipse(canvas.width * 0.18, canvas.height * 0.1, 70, 30, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(canvas.width * 0.82, canvas.height * 0.9, 64, 28, 0, 0, Math.PI * 2);
    context.fill();
  }

  return canvas;
};

export const GlobeView = ({ satellites, conjunctions, spaceWeather }: GlobeViewProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setSelectedSatellite = useAuroraStore((state) => state.setSelectedSatellite);
  const setHelioSimulationSeconds = useAuroraStore((state) => state.setHelioSimulationSeconds);
  const setHelioPlaybackRate = useAuroraStore((state) => state.setHelioPlaybackRate);
  const resetHelioSimulation = useAuroraStore((state) => state.resetHelioSimulation);
  const currentModeRef = useRef(useAuroraStore.getState().currentMode);
  const earthOnlyRef = useRef(useAuroraStore.getState().earthOnlyMode);
  const helioSimulationSecondsRef = useRef(useAuroraStore.getState().helioSimulationSeconds);
  const helioPlaybackRateRef = useRef(useAuroraStore.getState().helioPlaybackRate);
  const helioBurstIntensityRef = useRef(useAuroraStore.getState().helioBurstIntensity);
  const helioScenarioVersionRef = useRef(useAuroraStore.getState().helioScenarioVersion);
  const satellitesRef = useRef(satellites);
  const conjunctionsRef = useRef(conjunctions);
  const spaceWeatherRef = useRef(spaceWeather);
  const syncSatellitesRef = useRef<((nextSatellites: Satellite[]) => void) | null>(null);
  const syncConjunctionsRef = useRef<((nextConjunctions: ConjunctionWarning[]) => void) | null>(null);
  const syncSpaceWeatherRef = useRef<((nextSpaceWeather: SpaceWeather) => void) | null>(null);

  satellitesRef.current = satellites;
  conjunctionsRef.current = conjunctions;
  spaceWeatherRef.current = spaceWeather;

  useEffect(() => {
    if (!containerRef.current) return;

    Ion.defaultAccessToken = env.VITE_CESIUM_ION_TOKEN;
    const viewer = new Viewer(containerRef.current, {
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
      scene3DOnly: true,
      msaaSamples: 4
    });

    viewer.scene.backgroundColor = Color.BLACK;
    viewer.scene.highDynamicRange = true;
    viewer.scene.globe.baseColor = Color.fromCssColorString("#10202d");
    viewer.scene.globe.enableLighting = useSceneStore.getState().lighting;
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
    const fallbackImagery = viewer.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({
      url: buildModuleUrl("Assets/Textures/NaturalEarthII") + "/{z}/{x}/{reverseY}.jpg",
      tilingScheme: new GeographicTilingScheme(), maximumLevel: 2,
      credit: "Natural Earth II"
    }));
    let earthImageryLayer: Showable | null = null;
    let osmBuildingsTileset: Showable | null = null;
    let earthOnlyLastInteractionMs = performance.now();
    let lastHelioStoreSyncMs = -Number.POSITIVE_INFINITY;
    let helioSimulationBaseDate = new Date();
    let helioCmeLaunchDirection = Cartesian3.normalize(new Cartesian3(1, 0, 0), new Cartesian3());
    let helioCmeLaunchRight = Cartesian3.normalize(new Cartesian3(0, 1, 0), new Cartesian3());
    let helioCmeLaunchUp = Cartesian3.normalize(new Cartesian3(0, 0, 1), new Cartesian3());
    let helioCurrentCmeDirection = Cartesian3.clone(helioCmeLaunchDirection, new Cartesian3());
    let helioCmeCurveRight = 0;
    let helioCmeCurveUp = 0;
    let helioCmeSpreadScale = 1;
    let helioCmeFlareScale = 1;
    let helioCmeDensityTwist = 0;
    const helioPlanetTargets = new Map<string, { radius: number; getPosition: () => Cartesian3 }>();

    const getHelioSimulationDate = (): Date =>
      new Date(helioSimulationBaseDate.getTime() + helioSimulationSecondsRef.current * HELIO_ORBIT_TIME_SCALE_SECONDS * 1000);

    let helioCmeImpactStatus: "DIRECT HIT" | "GLANCING BLOW" | "NO IMPACT — MISS" = "DIRECT HIT";
    let helioCmeLaunchAngle = 0;
    let helioCmeSpeed = 1250;

    const regenerateHelioScenario = (): void => {
      const earthAtLaunch = positionOnHelioOrbit(
        HELIO_ORBIT_RADII.earth,
        getHelioOrbitAngle(helioSimulationBaseDate, 365.25, HELIO_PHASES.earth)
      );
      const baseDirection = Cartesian3.normalize(earthAtLaunch, new Cartesian3());
      const worldUp = Math.abs(Cartesian3.dot(baseDirection, Cartesian3.UNIT_Z)) > 0.98 ? Cartesian3.UNIT_Y : Cartesian3.UNIT_Z;
      const baseRight = Cartesian3.normalize(Cartesian3.cross(baseDirection, worldUp, new Cartesian3()), new Cartesian3());
      const baseUp = Cartesian3.normalize(Cartesian3.cross(baseRight, baseDirection, new Cartesian3()), new Cartesian3());

      // Realistic CME trajectory distribution
      const roll = Math.random();
      let launchAngle: number;
      if (roll < 0.15) {
        // Earth-directed (15% chance)
        launchAngle = (Math.random() - 0.5) * 40;
      } else if (roll < 0.40) {
        // Glancing blow (25% chance)
        const sign = Math.random() < 0.5 ? 1 : -1;
        launchAngle = sign * (20 + Math.random() * 25);
      } else {
        // Not Earth-directed (60% chance)
        const sign = Math.random() < 0.5 ? 1 : -1;
        launchAngle = sign * (45 + Math.random() * 135);
      }
      helioCmeLaunchAngle = launchAngle;

      // Determine impact status
      const absAngle = Math.abs(launchAngle);
      if (absAngle <= 20) {
        helioCmeImpactStatus = "DIRECT HIT";
      } else if (absAngle <= 45) {
        helioCmeImpactStatus = "GLANCING BLOW";
      } else {
        helioCmeImpactStatus = "NO IMPACT — MISS";
      }

      // Randomize CME speed: log-normal biased toward 400-1200 km/s
      helioCmeSpeed = 400 + Math.pow(Math.random(), 2) * 2600;

      // Launch elevation: ±15° from ecliptic
      const elevationDeg = randomInRange(-15, 15);
      const launchAngleRad = CesiumMath.toRadians(launchAngle);
      const elevationRad = CesiumMath.toRadians(elevationDeg);

      // Apply launch angle as rotation in the ecliptic plane around the Sun
      const cosA = Math.cos(launchAngleRad);
      const sinA = Math.sin(launchAngleRad);
      const lateralAim = sinA;
      const forwardAim = cosA;
      const verticalAim = Math.sin(elevationRad) * 0.3;

      helioCmeLaunchDirection = Cartesian3.normalize(new Cartesian3(
        baseDirection.x * forwardAim + baseRight.x * lateralAim + baseUp.x * verticalAim,
        baseDirection.y * forwardAim + baseRight.y * lateralAim + baseUp.y * verticalAim,
        baseDirection.z * forwardAim + baseRight.z * lateralAim + baseUp.z * verticalAim
      ), helioCmeLaunchDirection);
      helioCmeLaunchRight = Cartesian3.normalize(Cartesian3.cross(helioCmeLaunchDirection, worldUp, helioCmeLaunchRight), helioCmeLaunchRight);
      if (Cartesian3.magnitudeSquared(helioCmeLaunchRight) < 1e-6) {
        helioCmeLaunchRight = Cartesian3.normalize(Cartesian3.cross(helioCmeLaunchDirection, Cartesian3.UNIT_Y, helioCmeLaunchRight), helioCmeLaunchRight);
      }
      helioCmeLaunchUp = Cartesian3.normalize(Cartesian3.cross(helioCmeLaunchRight, helioCmeLaunchDirection, helioCmeLaunchUp), helioCmeLaunchUp);

      // Randomize other parameters
      helioCmeCurveRight = randomInRange(-0.12, 0.12);
      helioCmeCurveUp = randomInRange(-0.045, 0.045);

      // Cone spread: 20-120° mapped to spread scale
      const coneSpreadDeg = 20 + Math.random() * 100;
      helioCmeSpreadScale = coneSpreadDeg / 50; // normalize around ~50° = 1.0

      helioCmeFlareScale = randomInRange(0.92, 1.22);
      helioCmeDensityTwist = randomInRange(-0.1, 0.1);

      // Randomize burst intensity
      const newIntensity = 0.2 + Math.random() * 0.8;
      helioBurstIntensityRef.current = newIntensity;
      useAuroraStore.getState().setHelioBurstIntensity(newIntensity);
    };

    const syncHelioSimulationState = (force = false): void => {
      const nextSimulationSeconds = Number(helioSimulationSecondsRef.current.toFixed(2));
      const nowMs = performance.now();
      if (!force && nowMs - lastHelioStoreSyncMs < HELIO_SIM_SYNC_INTERVAL_MS) return;
      if (!force && nextSimulationSeconds === lastHelioStoreValue) return;
      lastHelioStoreSyncMs = nowMs;
      lastHelioStoreValue = nextSimulationSeconds;
      setHelioSimulationSeconds(nextSimulationSeconds);
    };
    regenerateHelioScenario();

    const applyModeVisibility = (mode: string): void => {
      const isEarthOnly = earthOnlyRef.current;
      const isHelio = mode === "HELIO";
      if (isEarthOnly) {
        setVisibility(earthObjects, false);
        setVisibility(helioObjects, false);
        selectedSatelliteRing.show = false;
        fallbackImagery.show = true;
        if (earthImageryLayer) earthImageryLayer.show = true;
        if (osmBuildingsTileset) osmBuildingsTileset.show = false;
        viewer.scene.globe.show = true;
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
        if (viewer.scene.sun) viewer.scene.sun.show = false;
        if (viewer.scene.moon) viewer.scene.moon.show = false;
        viewer.scene.globe.showGroundAtmosphere = true;
        controller.minimumZoomDistance = 25;
        controller.maximumZoomDistance = 200_000_000;
        return;
      }

      setVisibility(earthObjects, !isHelio);
      setVisibility(helioObjects, isHelio);
      if (isHelio) selectedSatelliteRing.show = false;
      fallbackImagery.show = !isHelio;
      if (earthImageryLayer) earthImageryLayer.show = !isHelio;
      if (osmBuildingsTileset) osmBuildingsTileset.show = !isHelio;
      viewer.scene.globe.show = !isHelio;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = !isHelio;
      if (viewer.scene.sun) viewer.scene.sun.show = !isHelio;
      if (viewer.scene.moon) viewer.scene.moon.show = !isHelio;
      viewer.scene.globe.showGroundAtmosphere = !isHelio;
      controller.minimumZoomDistance = isHelio ? 1_000 : 25;
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
      detachAerospaceCamera();
      if (earthOnlyRef.current) return;
      if (mode === "HELIO") {
        viewer.camera.flyTo({
          destination: HELIO_CAMERA_DESTINATION_VISUAL,
          orientation: {
            direction: HELIO_CAMERA_DIRECTION,
            up: Cartesian3.UNIT_Z
          },
          duration: 1.8,
          easingFunction: EasingFunction.QUADRATIC_IN_OUT
        });
      } else if (mode === "STORM") {
        useSceneStore.getState().requestCamera("polar");
      } else if (previousMode === "HELIO") {
        viewer.camera.flyTo({
          destination: EARTH_CAMERA_DESTINATION,
          orientation: EARTH_CAMERA_ORIENTATION,
          duration: 1.5,
          easingFunction: EasingFunction.QUADRATIC_OUT
        });
      }
    };

    if (hasValidCesiumIonToken(env.VITE_CESIUM_ION_TOKEN)) {
      createWorldTerrainAsync({ requestWaterMask: true, requestVertexNormals: true }).then((terrainProvider) => {
        if (!isDisposed && !viewer.isDestroyed()) viewer.terrainProvider = terrainProvider;
      }).catch(() => console.warn("[AURORA] Terrain unavailable; using the Earth ellipsoid."));

      IonImageryProvider.fromAssetId(2).then((provider) => {
        if (isDisposed || viewer.isDestroyed()) return;
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        earthImageryLayer = layer;
        layer.show = earthOnlyRef.current || currentModeRef.current !== "HELIO";
        layer.brightness = 1.08;
        layer.saturation = 0.88;
      }).catch(() => console.warn("[AURORA] Ion imagery unavailable; using bundled Earth imagery."));

      createOsmBuildingsAsync().then((tileset) => {
        if (isDisposed || viewer.isDestroyed()) { tileset.destroy(); return; }
        viewer.scene.primitives.add(tileset);
        osmBuildingsTileset = tileset;
        tileset.show = !earthOnlyRef.current && currentModeRef.current !== "HELIO";
      }).catch(() => console.warn("[AURORA] Buildings unavailable; globe navigation remains available."));
    }

    const earthR = earthRadiusMeters;
    // Cesium needs the scene to depth-test billboards against Earth and terrain.
    const satellitePoints = registerEarth(viewer.scene.primitives.add(new BillboardCollection({
      scene: viewer.scene,
      coarseDepthTestDistance: Number.POSITIVE_INFINITY,
    })));
    const satelliteOccluder = new GlobeOcclusion(viewer.scene.globe.ellipsoid, viewer.camera.positionWC);
    const catalogModels = installCatalogModels(viewer);
    const catalogIcon = (satellite:Satellite) => import.meta.env.BASE_URL + `models/${catalogModelKind(satellite) === "station" ? "satellite" : catalogModelKind(satellite)}-icon.svg`;
    const conjunctionPolylines = registerEarth(viewer.scene.primitives.add(new PolylineCollection()));
    const conjunctionMarkers = registerEarth(viewer.scene.primitives.add(new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE_AND_TRANSLUCENT })));
    const conjunctionLabels = registerEarth(viewer.scene.primitives.add(new LabelCollection({ scene: viewer.scene })));

    const satellitePointPool: SatelliteAnimState[] = [];
    let activeSatAnimStates: SatelliteAnimState[] = [];
    const satAnimByNorad = new Map<number, SatelliteAnimState>();
    const conjunctionVisualState: ConjunctionVisualState[] = [];
    let selectedSatelliteNoradId = useAuroraStore.getState().selectedSatellite?.noradId ?? null;
    let selectedConjunctionId = useAuroraStore.getState().selectedConjunction?.id ?? null;
    const selectedConjSatIds = new Set<number>();
    const conjOrbitPolylines = registerEarth(viewer.scene.primitives.add(new PolylineCollection()));
    let elapsedSceneSeconds = 0;
    let lastHelioStoreValue = -1;

    const catalogWorker = new Worker(new URL("../workers/catalog.worker.ts", import.meta.url), { type: "module" });
    let catalogGeneration = 0;
    let catalogWindow: CatalogWindow | null = null;
    let catalogWorkerFailed = false;
    let lastCatalogStatsMs = 0;
    catalogWorker.onmessage = (event: MessageEvent<CatalogWindow>) => {
      if (event.data.generation === catalogGeneration) { catalogWindow = event.data; catalogWorkerFailed = false; }
    };
    catalogWorker.onerror = () => { catalogWorkerFailed = true; };
    const catalogColors: Record<string, Color> = {
      Payload: Color.fromCssColorString("#6be8a5"),
      Debris: Color.fromCssColorString("#b1bcc8"),
      "Rocket body": Color.fromCssColorString("#edb96b"),
      Unknown: Color.fromCssColorString("#819ebc")
    };
    const catalogColor = (satellite: Satellite): Color => catalogColors[objectClassification(satellite).label] ?? catalogColors.Unknown;
    const initialCatalogPosition = (satellite: Satellite): Cartesian3 => useAuroraStore.getState().feedLastUpdated.satellites
      ? Cartesian3.fromDegrees(satellite.lon, satellite.lat, satellite.altitudeKm * 1000)
      : satelliteSnapshotPosition(satellite, false);

    const applySatelliteToState = (state: SatelliteAnimState, satellite: Satellite, thetaEpochSeconds: number): void => {
      const { radius, inclination, ascendingNode } = getOrbitParams(satellite);
      state.satellite = satellite;
      state.radius = radius;
      state.inclination = inclination;
      state.ascendingNode = ascendingNode;
      state.period = getOrbitalPeriod(radius);
      state.initialTheta = CesiumMath.toRadians(satellite.lon + 180);
      state.thetaEpochSeconds = thetaEpochSeconds;
      state.point.show = true;
      state.point.position = initialCatalogPosition(satellite);
      state.point.image = catalogIcon(satellite);
      state.catalogColor = catalogColor(satellite);
      state.point.color = Color.WHITE;
      state.point.id = { type: "satellite", satellite };
    };

    const createSatelliteAnimState = (satellite: Satellite, thetaEpochSeconds: number): SatelliteAnimState => {
      const { radius, inclination, ascendingNode } = getOrbitParams(satellite);
      const point = satellitePoints.add({
        image: catalogIcon(satellite), width:18, height:18,
        scaleByDistance: new NearFarScalar(1e5,1.5,2e7,0.65),
        show: false,
        position: initialCatalogPosition(satellite),
        color: Color.WHITE,
        disableDepthTestDistance: 0.0,
        id: { type: "satellite", satellite }
      });

      return {
        point,
        positionScratch: new Cartesian3(),
        catalogColor: catalogColor(satellite),
        satellite,
        radius,
        inclination,
        ascendingNode,
        period: getOrbitalPeriod(radius),
        initialTheta: CesiumMath.toRadians(satellite.lon + 180),
        thetaEpochSeconds
      };
    };

    const syncSatellitePoints = (nextSatellites: Satellite[]): void => {
      catalogGeneration++;
      catalogWindow = null;
      catalogWorker.postMessage({ satellites: nextSatellites, generation: catalogGeneration });
      satAnimByNorad.clear();
      activeSatAnimStates = [];

      nextSatellites.forEach((satellite, index) => {
        const state = satellitePointPool[index] ?? createSatelliteAnimState(satellite, elapsedSceneSeconds);
        if (!satellitePointPool[index]) {
          satellitePointPool.push(state);
        } else {
          applySatelliteToState(state, satellite, elapsedSceneSeconds);
        }
        activeSatAnimStates.push(state);
        satAnimByNorad.set(satellite.noradId, state);
      });

      for (let index = nextSatellites.length; index < satellitePointPool.length; index += 1) {
        satellitePointPool[index].point.show = false;
      }
    };

    const flyCameraToSatellite = (noradId: number): void => {
      detachAerospaceCamera();
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

    const getPickedHelioPlanetId = (picked: unknown): string | null => {
      if (typeof picked === "string" && helioPlanetTargets.has(picked)) {
        return picked;
      }

      if (typeof picked !== "object" || picked === null) {
        return null;
      }

      const record = picked as { id?: unknown };
      if (typeof record.id === "string" && helioPlanetTargets.has(record.id)) {
        return record.id;
      }

      if (typeof record.id === "object" && record.id !== null) {
        const nested = record.id as { id?: unknown };
        if (typeof nested.id === "string" && helioPlanetTargets.has(nested.id)) {
          return nested.id;
        }
      }

      return null;
    };

    const flyCameraToHelioPlanet = (planetId: string): void => {
      const target = helioPlanetTargets.get(planetId);
      if (!target) return;

      const focusPosition = target.getPosition();
      const cameraAway = Cartesian3.subtract(viewer.camera.position, focusPosition, new Cartesian3());
      const fallbackAway =
        Cartesian3.magnitudeSquared(cameraAway) < 1
          ? Cartesian3.normalize(new Cartesian3(-1, -0.35, 0.28), new Cartesian3())
          : Cartesian3.normalize(cameraAway, cameraAway);
      const offset = Cartesian3.multiplyByScalar(fallbackAway, target.radius * 18, new Cartesian3());
      offset.z += target.radius * 4;
      const destination = Cartesian3.add(focusPosition, offset, new Cartesian3());
      const direction = Cartesian3.normalize(Cartesian3.subtract(focusPosition, destination, new Cartesian3()), new Cartesian3());
      const up = Math.abs(Cartesian3.dot(direction, Cartesian3.UNIT_Z)) > 0.95 ? Cartesian3.UNIT_Y : Cartesian3.UNIT_Z;

      viewer.camera.flyTo({
        destination,
        orientation: {
          direction,
          up
        },
        duration: 1.2,
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
    const findSatelliteMatch = (objectRef: ConjunctionWarning["object1"]): Satellite | undefined => {
      const noradId = Number(objectRef.noradId);
      return satellitesRef.current.find((satellite) => satellite.noradId === noradId);
    };

    const syncConjunctionVisuals = (nextConjunctions: ConjunctionWarning[]): void => {
      conjunctionPolylines.removeAll();
      conjunctionMarkers.removeAll();
      conjunctionLabels.removeAll();
      conjunctionVisualState.length = 0;

      orderedConjunctionPairs(nextConjunctions).forEach(({ conjunction, number, color: pairColor }) => {
        if (!conjunction.tca || isNaN(new Date(conjunction.tca).getTime())) {
          return;
        }

        const sat1 = findSatelliteMatch(conjunction.object1);
        const sat2 = findSatelliteMatch(conjunction.object2);
        const riskLevel = resolveConjunctionRiskLevel(conjunction);

        const color = Color.fromCssColorString(pairColor);
        const pick = { type: "conjunction", id: conjunction.id };
        const width = conjunctionArcLineWidth(riskLevel);
        const sat1NoradId = sat1?.noradId ?? Number(conjunction.object1.noradId);
        const sat2NoradId = sat2?.noradId ?? Number(conjunction.object2.noradId);
        const object1Arc = conjunctionPolylines.add({
          id: pick,
          positions: [],
          show: false,
          width,
          material: Material.fromType("Color", { color: color.clone() })
        });
        const object2Arc = conjunctionPolylines.add({
          id: pick,
          positions: [],
          show: false,
          width,
          material: Material.fromType("PolylineDash", { color: color.clone(), gapColor: Color.TRANSPARENT, dashLength: 14 })
        });
        const missDistanceLine = conjunctionPolylines.add({
          positions: [],
          show: false,
          width,
          material: Material.fromType("Color", { color: color.clone() })
        });
        conjunctionVisualState.push({
          conjunction,
          pairNumber: number,
          pairColor: color,
          riskLevel,
          sat1NoradId,
          sat2NoradId,
          object1Arc,
          object2Arc,
          missDistanceLine,
          marker: conjunctionMarkers.add({
            id: pick,
            position: Cartesian3.ZERO,
            show: false,
            pixelSize: riskLevel === "watch" ? 9 : 11,
            color: color.clone(),
            outlineColor: Color.WHITE.withAlpha(0.35),
            outlineWidth: 1,
            disableDepthTestDistance: 0.0
          }),
          label: conjunctionLabels.add({
            id: pick,
            position: Cartesian3.ZERO,
            show: false,
            text: `TCA ${formatDurationToTca(conjunction.tca)}`,
            fillColor: color.clone(),
            font: "11px monospace",
            showBackground: true,
            backgroundColor: Color.BLACK.withAlpha(0.45),
            pixelOffset: new Cartesian2(12, -20),
            disableDepthTestDistance: 0
          }),
          object2Marker: conjunctionMarkers.add({ id: pick, position: Cartesian3.ZERO, show: false, pixelSize: 8, color: color.clone(), outlineColor: Color.WHITE, outlineWidth: 1, disableDepthTestDistance: 0 }),
          object2Label: conjunctionLabels.add({ id: pick, position: Cartesian3.ZERO, show: false, font: "11px monospace", fillColor: color.clone(), showBackground: true, backgroundColor: Color.BLACK.withAlpha(0.8), pixelOffset: new Cartesian2(12, 20), disableDepthTestDistance: 0 })
        });
      });
    };

    syncSatellitesRef.current = syncSatellitePoints;
    syncConjunctionsRef.current = syncConjunctionVisuals;

    syncSatellitePoints(satellitesRef.current);
    syncConjunctionVisuals(conjunctionsRef.current);
    if (selectedSatelliteNoradId !== null && currentModeRef.current !== "HELIO") {
      flyCameraToSatellite(selectedSatelliteNoradId);
    }

    const curtainTextures = [auroraCurtainTexture(), auroraCurtainTexture(true)];
    let auroraRibbons = [true, false].flatMap(north => [0, 1, 2].map(layer =>
      auroraRibbon(north, kpToAuroraRadiusDegrees(spaceWeatherRef.current.kpIndex), layer)));
    const reducedAuroraMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const auroraCapEntities = auroraRibbons.flatMap((_, index) => {
      const layer = index % 3;
      const curtain = registerEarth(viewer.entities.add({
        name: "Illustrative auroral curtain",
        wall: {
          positions: new CallbackProperty(() => auroraRibbons[index].positions, false),
          minimumHeights: new CallbackProperty(() => auroraRibbons[index].minimumHeights, false),
          maximumHeights: new CallbackProperty(() => auroraRibbons[index].maximumHeights, false),
          material: new ImageMaterialProperty({ image: curtainTextures[layer === 2 ? 1 : 0], transparent: true,
            color: new CallbackProperty(() => {
              const shimmer = reducedAuroraMotion ? 0.9 : 0.84 + 0.12 * Math.sin(performance.now() * 0.0007 + index);
              return Color.WHITE.withAlpha(shimmer * (currentModeRef.current === "STORM" ? 1 : 0.55));
            }, false) })
        }
      }));
      const rim = registerEarth(viewer.entities.add({
        name: "Illustrative auroral oval",
        polyline: {
          positions: new CallbackProperty(() => auroraRibbons[index].rim, false),
          width: layer === 0 ? 4 : 2,
          material: new PolylineGlowMaterialProperty({color: Color.fromCssColorString(layer === 2 ? "#987cf5" : "#68ffc4").withAlpha(layer === 0 ? 0.42 : 0.18), glowPower: 0.35, taperPower: 1})
        }
      }));
      return [curtain, rim];
    });

    // Schematic dipole traces replace the enclosing ellipsoid, which obscured
    // Earth when the camera moved outside it. No opaque atmospheric shell.
    const magnetosphere = registerEarth(viewer.scene.primitives.add(new PolylineCollection()));
    for (let meridian = 0; meridian < 12; meridian++) {
      const phi = meridian * Math.PI / 6;
      const positions: Cartesian3[] = [];
      const shell = 2.3;
      const start = Math.asin(Math.sqrt(1 / shell));
      for (let i = 0; i <= 96; i++) {
        const theta = start + (Math.PI - 2 * start) * i / 96;
        const r = earthR * shell * Math.sin(theta) ** 2;
        positions.push(new Cartesian3(r * Math.sin(theta) * Math.cos(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta)));
      }
      magnetosphere.add({ positions, width: 1.2, material: Material.fromType("Color", { color: Color.fromCssColorString("#72b9d0").withAlpha(0.14) }) });
    }

    let solarWindColor = getSolarWindColor(spaceWeatherRef.current.solarWindSpeed);
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

    const syncSpaceWeatherVisuals = (nextSpaceWeather: SpaceWeather): void => {
      solarWindColor = getSolarWindColor(nextSpaceWeather.solarWindSpeed);
      const auroraRadiusDeg = kpToAuroraRadiusDegrees(nextSpaceWeather.kpIndex);
      auroraRibbons = [true, false].flatMap(north => [0, 1, 2].map(layer => auroraRibbon(north, auroraRadiusDeg, layer)));
    };

    syncSpaceWeatherRef.current = syncSpaceWeatherVisuals;
    syncSpaceWeatherVisuals(spaceWeatherRef.current);

    const getHelioPlanetAngle = (orbitalPeriodDays: number, phase: number): number =>
      getHelioOrbitAngle(getHelioSimulationDate(), orbitalPeriodDays, phase);
    const getHelioEarthAngle = (): number => getHelioPlanetAngle(365.25, HELIO_PHASES.earth);
    const getHelioElapsedSeconds = (): number => helioSimulationSecondsRef.current;
    const createHelioCoronaPrimitive = (radius: number, color: Color): Primitive =>
      viewer.scene.primitives.add(new Primitive({
        geometryInstances: new GeometryInstance({
          geometry: new EllipsoidGeometry({
            radii: new Cartesian3(radius, radius, radius),
            vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
            stackPartitions: 64,
            slicePartitions: 64
          }),
          attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) }
        }),
        appearance: new PerInstanceColorAppearance({
          translucent: true,
          closed: false
        }),
        asynchronous: false,
        allowPicking: false
      }));
    const l1MarkerImage = createDiamondMarkerImage();
    const earthTexture = createPlanetTexture("earth");
    const venusTexture = createPlanetTexture("venus");
    const marsTexture = createPlanetTexture("mars");

    const helioStarfield = registerHelio(viewer.scene.primitives.add(new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE_AND_TRANSLUCENT })));
    for (let index = 0; index < 800; index += 1) {
      const theta = randomInRange(0, CesiumMath.TWO_PI);
      const z = randomInRange(-1, 1);
      const radial = Math.sqrt(1 - z * z);
      const distance = randomInRange(earthR * 500, earthR * 2000);
      helioStarfield.add({
        position: new Cartesian3(Math.cos(theta) * radial * distance, Math.sin(theta) * radial * distance, z * distance),
        pixelSize: randomInRange(1, 2.1),
        color: Color.WHITE.withAlpha(randomInRange(0.4, 0.8)),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      });
    }

    [
      createHelioCoronaPrimitive(HELIO_VISUAL_SUN_RADIUS * 3.0, Color.fromCssColorString("#ff6400").withAlpha(0.025)),
      createHelioCoronaPrimitive(HELIO_VISUAL_SUN_RADIUS * 2.0, Color.fromCssColorString("#ffa01e").withAlpha(0.06)),
      createHelioCoronaPrimitive(HELIO_VISUAL_SUN_RADIUS * 1.4, Color.fromCssColorString("#ffdc50").withAlpha(0.12)),
      viewer.entities.add({
        id: "helio-planet-sun",
        position: Cartesian3.ZERO,
        ellipsoid: {
          radii: new Cartesian3(HELIO_VISUAL_SUN_RADIUS, HELIO_VISUAL_SUN_RADIUS, HELIO_VISUAL_SUN_RADIUS),
          material: Color.fromCssColorString("#fffde7").withAlpha(0.98)
        },
        label: {
          text: "Sun",
          font: "12px 'JetBrains Mono', monospace",
          fillColor: Color.fromCssColorString("#fff7c9"),
          showBackground: true,
          backgroundColor: Color.fromCssColorString("#301500").withAlpha(0.78),
          pixelOffset: new Cartesian2(0, 28),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      }),
      viewer.entities.add({
        polyline: {
          positions: createOrbitRingPositions(HELIO_ORBIT_RADII.earth),
          width: 7,
          material: Color.fromCssColorString("#64b4ff").withAlpha(0.1)
        }
      }),
      viewer.entities.add({
        polyline: {
          positions: createOrbitRingPositions(HELIO_ORBIT_RADII.earth),
          width: 2.2,
          material: new PolylineDashMaterialProperty({
            color: Color.fromCssColorString("#64b4ff").withAlpha(0.5),
            gapColor: Color.TRANSPARENT,
            dashLength: 32,
            dashPattern: HELIO_ORBIT_DASH_PATTERN
          })
        }
      }),
      viewer.entities.add({
        polyline: {
          positions: createOrbitRingPositions(HELIO_ORBIT_RADII.venus),
          width: 1.1,
          material: new PolylineDashMaterialProperty({
            color: Color.fromCssColorString("#ffc864").withAlpha(0.3),
            gapColor: Color.TRANSPARENT,
            dashLength: 20,
            dashPattern: HELIO_ORBIT_DASH_PATTERN
          })
        }
      }),
      viewer.entities.add({
        polyline: {
          positions: createOrbitRingPositions(HELIO_ORBIT_RADII.mars),
          width: 1.1,
          material: new PolylineDashMaterialProperty({
            color: Color.fromCssColorString("#ff7850").withAlpha(0.3),
            gapColor: Color.TRANSPARENT,
            dashLength: 20,
            dashPattern: HELIO_ORBIT_DASH_PATTERN
          })
        }
      })
    ].forEach((entity) => registerHelio(entity));
    helioPlanetTargets.set("helio-planet-sun", { radius: HELIO_VISUAL_SUN_RADIUS, getPosition: () => Cartesian3.ZERO });

    const helioPoints = registerHelio(viewer.scene.primitives.add(new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE_AND_TRANSLUCENT })));
    const helioDensityField = registerHelio(viewer.scene.primitives.add(new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE_AND_TRANSLUCENT })));
    const helioDensityStates: HelioDensityParticleState[] = [];
    for (let index = 0; index < 180; index += 1) {
      helioDensityStates.push({
        primitive: helioDensityField.add({
          position: new Cartesian3(),
          pixelSize: randomInRange(5, 12),
          color: Color.fromCssColorString("#ff9f40").withAlpha(randomInRange(0.03, 0.12)),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }),
        distanceOffset: Math.random(),
        lateralBias: randomInRange(-1, 1),
        verticalBias: randomInRange(-0.18, 0.18),
        alpha: randomInRange(0.03, 0.12),
        size: randomInRange(5, 12)
      });
    }

    const earthPosition = new CallbackPositionProperty(
      (_time, result) => positionOnHelioOrbit(HELIO_ORBIT_RADII.earth, getHelioEarthAngle(), result),
      false
    );
    const venusPosition = new CallbackPositionProperty(
      (_time, result) => positionOnHelioOrbit(HELIO_ORBIT_RADII.venus, getHelioPlanetAngle(224.7, HELIO_PHASES.venus), result),
      false
    );
    const marsPosition = new CallbackPositionProperty(
      (_time, result) => positionOnHelioOrbit(HELIO_ORBIT_RADII.mars, getHelioPlanetAngle(687, HELIO_PHASES.mars), result),
      false
    );
    const initialHelioEarthPosition = positionOnHelioOrbit(HELIO_ORBIT_RADII.earth, getHelioEarthAngle());
    const helioEarthGlow = helioPoints.add({
      position: Cartesian3.clone(initialHelioEarthPosition, new Cartesian3()),
      pixelSize: 28,
      color: Color.fromCssColorString("#4488ff").withAlpha(0.2),
      id: "helio-planet-earth",
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    });
    const helioEarthCore = helioPoints.add({
      position: Cartesian3.clone(initialHelioEarthPosition, new Cartesian3()),
      pixelSize: 14,
      color: Color.fromCssColorString("#4488ff"),
      id: "helio-planet-earth",
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    });
    registerHelio(viewer.entities.add({
      id: "helio-planet-earth-sphere",
      position: earthPosition,
      ellipsoid: {
        radii: new Cartesian3(HELIO_PLANET_RADII.earth, HELIO_PLANET_RADII.earth, HELIO_PLANET_RADII.earth),
        material: new ImageMaterialProperty({ image: earthTexture })
      }
    }));
    registerHelio(viewer.entities.add({
      id: "helio-planet-earth-label",
      position: earthPosition,
      label: {
        text: "Earth",
        font: "11px JetBrains Mono",
        fillColor: Color.fromCssColorString("#88bbff"),
        showBackground: false,
        pixelOffset: new Cartesian2(0, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    }));

    registerHelio(viewer.entities.add({
      id: "helio-planet-venus",
      position: venusPosition,
      ellipsoid: {
        radii: new Cartesian3(HELIO_PLANET_RADII.venus, HELIO_PLANET_RADII.venus, HELIO_PLANET_RADII.venus),
        material: new ImageMaterialProperty({ image: venusTexture })
      }
    }));
    registerHelio(viewer.entities.add({
      id: "helio-planet-venus-marker",
      position: venusPosition,
      point: {
        pixelSize: 8,
        color: Color.fromCssColorString("#ffd278").withAlpha(0.9),
        outlineColor: Color.WHITE.withAlpha(0.55),
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: "Venus",
        font: "10px 'JetBrains Mono', monospace",
        fillColor: Color.fromCssColorString("#ffe0a6"),
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#251200").withAlpha(0.52),
        pixelOffset: new Cartesian2(0, 16),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    }));

    registerHelio(viewer.entities.add({
      id: "helio-planet-mars",
      position: marsPosition,
      ellipsoid: {
        radii: new Cartesian3(HELIO_PLANET_RADII.mars, HELIO_PLANET_RADII.mars, HELIO_PLANET_RADII.mars),
        material: new ImageMaterialProperty({ image: marsTexture })
      }
    }));
    registerHelio(viewer.entities.add({
      id: "helio-planet-mars-marker",
      position: marsPosition,
      point: {
        pixelSize: 8,
        color: Color.fromCssColorString("#ff643c").withAlpha(0.9),
        outlineColor: Color.WHITE.withAlpha(0.55),
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: "Mars",
        font: "10px 'JetBrains Mono', monospace",
        fillColor: Color.fromCssColorString("#ffb19b"),
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#250500").withAlpha(0.56),
        pixelOffset: new Cartesian2(0, 16),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    }));

    registerHelio(viewer.entities.add({
      position: new CallbackPositionProperty((_time, result) => positionOnHelioOrbit(HELIO_ORBIT_RADII.earth - HELIO_L1_OFFSET, getHelioEarthAngle(), result), false),
      billboard: {
        image: l1MarkerImage,
        scale: new CallbackProperty(() => 0.82 + 0.16 * (0.5 + 0.5 * Math.sin(performance.now() * 0.0031)), false),
        color: Color.fromCssColorString("#00ffff"),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: "L1  DSCOVR\nEarly Warning Sensor",
        font: "11px 'JetBrains Mono', monospace",
        fillColor: Color.fromCssColorString("#bcffff"),
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#051624").withAlpha(0.8),
        pixelOffset: new Cartesian2(28, -4),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    }));

    helioPlanetTargets.set("helio-planet-earth", { radius: HELIO_PLANET_RADII.earth, getPosition: () => positionOnHelioOrbit(HELIO_ORBIT_RADII.earth, getHelioEarthAngle()) });
    helioPlanetTargets.set("helio-planet-earth-sphere", { radius: HELIO_PLANET_RADII.earth, getPosition: () => positionOnHelioOrbit(HELIO_ORBIT_RADII.earth, getHelioEarthAngle()) });
    helioPlanetTargets.set("helio-planet-earth-label", { radius: HELIO_PLANET_RADII.earth, getPosition: () => positionOnHelioOrbit(HELIO_ORBIT_RADII.earth, getHelioEarthAngle()) });
    helioPlanetTargets.set("helio-planet-venus", { radius: HELIO_PLANET_RADII.venus, getPosition: () => positionOnHelioOrbit(HELIO_ORBIT_RADII.venus, getHelioPlanetAngle(224.7, HELIO_PHASES.venus)) });
    helioPlanetTargets.set("helio-planet-venus-marker", { radius: HELIO_PLANET_RADII.venus, getPosition: () => positionOnHelioOrbit(HELIO_ORBIT_RADII.venus, getHelioPlanetAngle(224.7, HELIO_PHASES.venus)) });
    helioPlanetTargets.set("helio-planet-mars", { radius: HELIO_PLANET_RADII.mars, getPosition: () => positionOnHelioOrbit(HELIO_ORBIT_RADII.mars, getHelioPlanetAngle(687, HELIO_PHASES.mars)) });
    helioPlanetTargets.set("helio-planet-mars-marker", { radius: HELIO_PLANET_RADII.mars, getPosition: () => positionOnHelioOrbit(HELIO_ORBIT_RADII.mars, getHelioPlanetAngle(687, HELIO_PHASES.mars)) });

    const createFlameHierarchyCallback = (apex: Cartesian3, front: Cartesian3[]): CallbackProperty =>
      new CallbackProperty(() => new PolygonHierarchy([
        Cartesian3.clone(apex, new Cartesian3()),
        ...front.map((point) => Cartesian3.clone(point, new Cartesian3()))
      ]), false);
    const createFlameMaterial = (color: string, minAlpha: number, maxAlpha: number, speed: number): ColorMaterialProperty =>
      new ColorMaterialProperty(new CallbackProperty(() => {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * speed);
        return Color.fromCssColorString(color).withAlpha(minAlpha + (maxAlpha - minAlpha) * pulse);
      }, false));

    const helioCmeEdges = registerHelio(viewer.scene.primitives.add(new PolylineCollection()));
    const helioCmeLeftGlow = helioCmeEdges.add({
      positions: [Cartesian3.ZERO, positionOnHelioOrbit(HELIO_ORBIT_RADII.earth * HELIO_CME_PROGRESS_START, -HELIO_CME_VISUAL_HALF_ANGLE)],
      width: 7,
      material: Material.fromType("Color", { color: Color.fromCssColorString("#ff6a00").withAlpha(0.12) })
    });
    const helioCmeRightGlow = helioCmeEdges.add({
      positions: [Cartesian3.ZERO, positionOnHelioOrbit(HELIO_ORBIT_RADII.earth * HELIO_CME_PROGRESS_START, HELIO_CME_VISUAL_HALF_ANGLE)],
      width: 7,
      material: Material.fromType("Color", { color: Color.fromCssColorString("#ff6a00").withAlpha(0.12) })
    });
    const helioCmeLeadingGlow = helioCmeEdges.add({
      positions: createOrbitArcPositions(HELIO_ORBIT_RADII.earth * HELIO_CME_PROGRESS_START, 0, HELIO_CME_VISUAL_HALF_ANGLE, 8),
      width: 9,
      material: Material.fromType("Color", { color: Color.fromCssColorString("#ff7b00").withAlpha(0.16) })
    });
    const helioCmeLeftEdge = helioCmeEdges.add({
      positions: [Cartesian3.ZERO, positionOnHelioOrbit(HELIO_ORBIT_RADII.earth * HELIO_CME_PROGRESS_START, -HELIO_CME_VISUAL_HALF_ANGLE)],
      width: 2.4,
      material: Material.fromType("Color", { color: Color.fromCssColorString("#ff9a1f").withAlpha(0.86) })
    });
    const helioCmeRightEdge = helioCmeEdges.add({
      positions: [Cartesian3.ZERO, positionOnHelioOrbit(HELIO_ORBIT_RADII.earth * HELIO_CME_PROGRESS_START, HELIO_CME_VISUAL_HALF_ANGLE)],
      width: 2.4,
      material: Material.fromType("Color", { color: Color.fromCssColorString("#ff9a1f").withAlpha(0.86) })
    });
    const helioCmeLeadingEdge = helioCmeEdges.add({
      positions: createOrbitArcPositions(HELIO_ORBIT_RADII.earth * HELIO_CME_PROGRESS_START, 0, HELIO_CME_VISUAL_HALF_ANGLE, 8),
      width: 3.6,
      material: Material.fromType("Color", { color: Color.fromCssColorString("#ffd857").withAlpha(0.95) })
    });
    const cmeOuterApex = new Cartesian3(HELIO_VISUAL_SUN_RADIUS * 0.9, 0, 0);
    const cmeMidApex = new Cartesian3(HELIO_VISUAL_SUN_RADIUS * 0.98, 0, 0);
    const cmeCoreApex = new Cartesian3(HELIO_VISUAL_SUN_RADIUS * 1.06, 0, 0);
    const cmeOuterFront = createMutableFlameFront(19);
    const cmeMidFront = createMutableFlameFront(17);
    const cmeCoreFront = createMutableFlameFront(15);
    registerHelio(viewer.entities.add({
      polygon: {
        hierarchy: createFlameHierarchyCallback(cmeOuterApex, cmeOuterFront),
        material: createFlameMaterial("#ff3b00", 0.07, 0.14, 0.0028),
        perPositionHeight: true
      }
    }));
    registerHelio(viewer.entities.add({
      polygon: {
        hierarchy: createFlameHierarchyCallback(cmeMidApex, cmeMidFront),
        material: createFlameMaterial("#ff7b00", 0.12, 0.22, 0.0036),
        perPositionHeight: true
      }
    }));
    registerHelio(viewer.entities.add({
      polygon: {
        hierarchy: createFlameHierarchyCallback(cmeCoreApex, cmeCoreFront),
        material: createFlameMaterial("#ffd24a", 0.1, 0.2, 0.0048),
        perPositionHeight: true
      }
    }));
    const helioCmeEmbers = registerHelio(viewer.scene.primitives.add(new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE_AND_TRANSLUCENT })));
    const helioCmeEmberStates: HelioCmeEmberState[] = [];
    for (let index = 0; index < 56; index += 1) {
      helioCmeEmberStates.push({
        primitive: helioCmeEmbers.add({
          position: new Cartesian3(),
          pixelSize: randomInRange(2, 4.8),
          color: Color.fromCssColorString("#ffb347").withAlpha(randomInRange(0.3, 0.85)),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }),
        progressOffset: Math.random(),
        lateralBias: randomInRange(-0.8, 0.8),
        liftBias: randomInRange(-0.32, 0.32),
        speedScale: randomInRange(0.75, 1.35),
        alpha: randomInRange(0.28, 0.82),
        size: randomInRange(2, 4.8)
      });
    }

    registerHelio(viewer.entities.add({
      position: new CallbackPositionProperty((_time, result) => {
        const earthDistance = Cartesian3.distance(Cartesian3.ZERO, positionOnHelioOrbit(HELIO_ORBIT_RADII.earth, getHelioEarthAngle()));
        const coneLength = earthDistance * getHelioCmeProgress(getHelioElapsedSeconds()) + HELIO_AU_SCENE_UNITS * 0.07;
        return Cartesian3.multiplyByScalar(helioCurrentCmeDirection, coneLength, result ?? new Cartesian3());
      }, false),
      label: {
        text: new CallbackProperty(() => `ESTIMATED ARRIVAL: ${formatHelioArrivalLabel(getHelioElapsedSeconds())}`, false),
        font: "11px 'JetBrains Mono', monospace",
        fillColor: Color.fromCssColorString("#ffca84"),
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#2a1100").withAlpha(0.82),
        pixelOffset: HELIO_CME_OFFSET,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    }));
    const helioEarthPositionScratch = new Cartesian3();
    const helioSunToEarthScratch = new Cartesian3();
    const helioRightScratch = new Cartesian3();
    const helioEdge1DirScratch = new Cartesian3();
    const helioEdge2DirScratch = new Cartesian3();
    const helioTip1Scratch = new Cartesian3();
    const helioTipCenterScratch = new Cartesian3();
    const helioTip2Scratch = new Cartesian3();
    const helioUpScratch = new Cartesian3();
    const updateHelioVisuals = (time: JulianDate, deltaSeconds: number, advanceCme: boolean): void => {
      const earthAngle = getHelioEarthAngle();
      const helioEarthPosition = positionOnHelioOrbit(HELIO_ORBIT_RADII.earth, earthAngle, helioEarthPositionScratch);
      helioEarthGlow.position = Cartesian3.clone(helioEarthPosition, new Cartesian3());
      helioEarthCore.position = Cartesian3.clone(helioEarthPosition, new Cartesian3());
      const burstIntensity = helioBurstIntensityRef.current;
      const curveScale = 0.72 + burstIntensity * 0.32;
      const spreadScale = helioCmeSpreadScale * (0.78 + burstIntensity * 0.34);
      const flameScale = helioCmeFlareScale * (0.72 + burstIntensity * 0.56);
      const densityTwist = helioCmeDensityTwist * (0.7 + burstIntensity * 0.35);
      const densityScale = 0.8 + burstIntensity * 0.45;
      const emberScale = 0.82 + burstIntensity * 0.5;

      if (advanceCme && currentModeRef.current === "HELIO" && !earthOnlyRef.current && helioPlaybackRateRef.current > 0) {
        helioSimulationSecondsRef.current = Math.min(
          HELIO_CME_DURATION_SECONDS,
          helioSimulationSecondsRef.current + deltaSeconds * helioPlaybackRateRef.current * HELIO_PLAYBACK_BASE_RATE
        );
        syncHelioSimulationState();
        if (helioSimulationSecondsRef.current >= HELIO_CME_DURATION_SECONDS && helioPlaybackRateRef.current !== 0) {
          helioPlaybackRateRef.current = 0;
          setHelioPlaybackRate(0);
        }
      }

      const sunToEarth = Cartesian3.normalize(
        Cartesian3.subtract(helioEarthPosition, Cartesian3.ZERO, helioSunToEarthScratch),
        helioSunToEarthScratch
      );
      const cmeProgress = getHelioCmeProgress(getHelioElapsedSeconds());
      helioCurrentCmeDirection = Cartesian3.normalize(new Cartesian3(
        helioCmeLaunchDirection.x + helioCmeLaunchRight.x * (helioCmeCurveRight * curveScale * cmeProgress) + helioCmeLaunchUp.x * (helioCmeCurveUp * curveScale * Math.sin(cmeProgress * Math.PI)),
        helioCmeLaunchDirection.y + helioCmeLaunchRight.y * (helioCmeCurveRight * curveScale * cmeProgress) + helioCmeLaunchUp.y * (helioCmeCurveUp * curveScale * Math.sin(cmeProgress * Math.PI)),
        helioCmeLaunchDirection.z + helioCmeLaunchRight.z * (helioCmeCurveRight * curveScale * cmeProgress) + helioCmeLaunchUp.z * (helioCmeCurveUp * curveScale * Math.sin(cmeProgress * Math.PI))
      ), helioCurrentCmeDirection);
      const right = Cartesian3.cross(helioCurrentCmeDirection, helioCmeLaunchUp, helioRightScratch);
      if (Cartesian3.magnitudeSquared(right) < 1e-6) {
        Cartesian3.cross(helioCurrentCmeDirection, Cartesian3.UNIT_Z, right);
      }
      Cartesian3.normalize(right, right);
      const up = Cartesian3.normalize(Cartesian3.cross(right, helioCurrentCmeDirection, helioUpScratch), helioUpScratch);
      const sunEarthDistance = Cartesian3.distance(Cartesian3.ZERO, helioEarthPosition);

      helioDensityStates.forEach((state, index) => {
        const progress = 0.14 + (((helioSimulationSecondsRef.current * 0.00018) + state.distanceOffset) % 1) * 0.88;
        const centerDistance = sunEarthDistance * progress;
        const spreadScale = HELIO_AU_SCENE_UNITS * (0.02 + (1 - progress) * 0.03);
        const twist = densityTwist * progress;
        const densityPosition = new Cartesian3(
          helioCurrentCmeDirection.x * centerDistance + right.x * (state.lateralBias + twist) * spreadScale + up.x * state.verticalBias * spreadScale * 0.4,
          helioCurrentCmeDirection.y * centerDistance + right.y * (state.lateralBias + twist) * spreadScale + up.y * state.verticalBias * spreadScale * 0.4,
          helioCurrentCmeDirection.z * centerDistance + right.z * (state.lateralBias + twist) * spreadScale + up.z * state.verticalBias * spreadScale * 0.4
        );
        const densityPulse = 0.55 + 0.45 * Math.sin(helioSimulationSecondsRef.current * 0.002 + index * 0.7);
        state.primitive.position = densityPosition;
        state.primitive.pixelSize = state.size * (0.8 + densityPulse * 0.45) * densityScale;
        state.primitive.color = Color.fromCssColorString("#ff9f40").withAlpha(clamp(state.alpha * (0.4 + densityPulse * 0.6) * (0.78 + burstIntensity * 0.34), 0, 0.28));
      });

      const spread = Math.tan(HELIO_CME_VISUAL_HALF_ANGLE * spreadScale);
      const edge1Dir = Cartesian3.normalize(new Cartesian3(
        helioCurrentCmeDirection.x + spread * right.x,
        helioCurrentCmeDirection.y + spread * right.y,
        helioCurrentCmeDirection.z + spread * right.z
      ), helioEdge1DirScratch);
      const edge2Dir = Cartesian3.normalize(new Cartesian3(
        helioCurrentCmeDirection.x - spread * right.x,
        helioCurrentCmeDirection.y - spread * right.y,
        helioCurrentCmeDirection.z - spread * right.z
      ), helioEdge2DirScratch);

      const coneLength = sunEarthDistance * cmeProgress;
      const tip1 = Cartesian3.multiplyByScalar(edge1Dir, coneLength, helioTip1Scratch);
      const tipCenter = Cartesian3.multiplyByScalar(helioCurrentCmeDirection, coneLength, helioTipCenterScratch);
      const tip2 = Cartesian3.multiplyByScalar(edge2Dir, coneLength, helioTip2Scratch);
      const flameTime = getHelioElapsedSeconds();
      const outerFrontPositions = createFireConeFrontPositions(helioCurrentCmeDirection, right, up, coneLength * 1.02, HELIO_CME_VISUAL_HALF_ANGLE * 1.04 * spreadScale, flameTime, 1.25 * flameScale, 0.08 + burstIntensity * 0.02, cmeOuterFront.length - 1);
      const midFrontPositions = createFireConeFrontPositions(helioCurrentCmeDirection, right, up, coneLength * 0.94, HELIO_CME_VISUAL_HALF_ANGLE * 0.82 * spreadScale, flameTime + 0.35, 0.95 * flameScale, 0.05 + burstIntensity * 0.014, cmeMidFront.length - 1);
      const coreFrontPositions = createFireConeFrontPositions(helioCurrentCmeDirection, right, up, coneLength * 0.82, HELIO_CME_VISUAL_HALF_ANGLE * 0.56 * spreadScale, flameTime + 0.72, 0.58 * flameScale, 0.025 + burstIntensity * 0.008, cmeCoreFront.length - 1);

      Cartesian3.multiplyByScalar(helioCurrentCmeDirection, HELIO_VISUAL_SUN_RADIUS * 0.88, cmeOuterApex);
      Cartesian3.multiplyByScalar(helioCurrentCmeDirection, HELIO_VISUAL_SUN_RADIUS * 0.96, cmeMidApex);
      Cartesian3.multiplyByScalar(helioCurrentCmeDirection, HELIO_VISUAL_SUN_RADIUS * 1.04, cmeCoreApex);
      outerFrontPositions.forEach((position, index) => Cartesian3.clone(position, cmeOuterFront[index]));
      midFrontPositions.forEach((position, index) => Cartesian3.clone(position, cmeMidFront[index]));
      coreFrontPositions.forEach((position, index) => Cartesian3.clone(position, cmeCoreFront[index]));

      const edgeGlowPulse = 0.5 + 0.5 * Math.sin(flameTime * 7.5);
      const edgeHotPulse = 0.5 + 0.5 * Math.sin(flameTime * 11.5 + 0.6);
      helioCmeLeftGlow.width = (6 + edgeGlowPulse * 4) * (0.84 + burstIntensity * 0.3);
      helioCmeRightGlow.width = (6 + edgeGlowPulse * 4) * (0.84 + burstIntensity * 0.3);
      helioCmeLeadingGlow.width = (8 + edgeGlowPulse * 5) * (0.84 + burstIntensity * 0.34);
      helioCmeLeadingEdge.width = (3 + edgeHotPulse * 2.2) * (0.88 + burstIntensity * 0.22);

      const glowColor = Color.fromCssColorString("#ff5a00").withAlpha(clamp((0.08 + edgeGlowPulse * 0.12) * (0.8 + burstIntensity * 0.28), 0, 0.42));
      const edgeColor = Color.fromCssColorString("#ff9e2f").withAlpha(clamp((0.74 + edgeHotPulse * 0.18) * (0.86 + burstIntensity * 0.16), 0, 1));
      const leadingColor = Color.fromCssColorString("#fff1a6").withAlpha(clamp((0.72 + edgeHotPulse * 0.24) * (0.86 + burstIntensity * 0.18), 0, 1));
      (helioCmeLeftGlow.material.uniforms as { color: Color }).color = glowColor;
      (helioCmeRightGlow.material.uniforms as { color: Color }).color = glowColor;
      (helioCmeLeadingGlow.material.uniforms as { color: Color }).color = Color.fromCssColorString("#ff8a00").withAlpha(clamp((0.12 + edgeGlowPulse * 0.16) * (0.84 + burstIntensity * 0.24), 0, 0.46));
      (helioCmeLeftEdge.material.uniforms as { color: Color }).color = edgeColor;
      (helioCmeRightEdge.material.uniforms as { color: Color }).color = edgeColor;
      (helioCmeLeadingEdge.material.uniforms as { color: Color }).color = leadingColor;

      helioCmeLeftGlow.positions = [Cartesian3.clone(cmeOuterApex, new Cartesian3()), Cartesian3.clone(outerFrontPositions[0], new Cartesian3())];
      helioCmeRightGlow.positions = [Cartesian3.clone(cmeOuterApex, new Cartesian3()), Cartesian3.clone(outerFrontPositions[outerFrontPositions.length - 1], new Cartesian3())];
      helioCmeLeadingGlow.positions = outerFrontPositions.map((position) => Cartesian3.clone(position, new Cartesian3()));
      helioCmeLeftEdge.positions = [Cartesian3.clone(cmeMidApex, new Cartesian3()), Cartesian3.clone(midFrontPositions[0], new Cartesian3())];
      helioCmeRightEdge.positions = [Cartesian3.clone(cmeMidApex, new Cartesian3()), Cartesian3.clone(midFrontPositions[midFrontPositions.length - 1], new Cartesian3())];
      helioCmeLeadingEdge.positions = createBezierArcPositions(tip1, tipCenter, tip2, 8).map((position, index) => {
        const source = midFrontPositions[Math.min(index * 2, midFrontPositions.length - 1)] ?? position;
        return Cartesian3.clone(source, new Cartesian3());
      });

      helioCmeEmberStates.forEach((ember, index) => {
        const emberProgress = (getHelioCmeProgress(getHelioElapsedSeconds()) * 0.52 + ember.progressOffset + flameTime * 0.038 * ember.speedScale) % 1.16;
        const progressAlongCone = clamp(0.08 + emberProgress * 0.92, 0.08, 1.08);
        const lateralScale = ember.lateralBias * spread * (0.2 + progressAlongCone * 0.7);
        const liftScale = ember.liftBias * (0.14 + progressAlongCone * 0.06);
        const emberDir = new Cartesian3(
          helioCurrentCmeDirection.x + lateralScale * right.x + liftScale * up.x,
          helioCurrentCmeDirection.y + lateralScale * right.y + liftScale * up.y,
          helioCurrentCmeDirection.z + lateralScale * right.z + liftScale * up.z
        );
        Cartesian3.normalize(emberDir, emberDir);
        const emberLength = coneLength * progressAlongCone;
        ember.primitive.position = Cartesian3.multiplyByScalar(emberDir, emberLength, new Cartesian3());
        const emberPulse = 0.45 + 0.55 * Math.sin(flameTime * 9 + index * 0.85);
        ember.primitive.pixelSize = ember.size * (0.8 + emberPulse * 0.7) * emberScale;
        const emberHeat = clamp(1 - progressAlongCone * 0.7, 0, 1);
        const emberColor = Color.lerp(
          Color.fromCssColorString("#ff3b00"),
          Color.fromCssColorString("#ffd86a"),
          emberHeat,
          new Color()
        );
        emberColor.alpha = clamp(ember.alpha * (0.4 + emberPulse * 0.6) * clamp(1.12 - progressAlongCone, 0.18, 1) * (0.76 + burstIntensity * 0.32), 0, 1);
        ember.primitive.color = emberColor;
      });
    };
    updateHelioVisuals(JulianDate.now(), 0, false);

    const presentation = enhanceScene(viewer, {
      selected: () => {
        const selected = selectedSatelliteNoradId === null ? null : satAnimByNorad.get(selectedSatelliteNoradId);
        return useSceneStore.getState().satellitesOn && selected && (!useAuroraStore.getState().feedLastUpdated.satellites || propagatedPosition(selected.satellite)) ? { satellite: selected.satellite, position: selected.point.position } : null;
      },
      catalog: () => satellitesRef.current,
      helioHome: () => transitionCameraForMode("HELIO")
    });

    let lastFrameMs = performance.now();
    const startTimeMs = performance.now();
    const onPreRender = (_scene: unknown, time: JulianDate): void => {
      const nowMs = performance.now();
      const deltaSeconds = Math.min((nowMs - lastFrameMs) / 1000, 0.12);
      lastFrameMs = nowMs;
      const timeSeconds = JulianDate.toDate(time).getTime() / 1000;
      const elapsedSeconds = (nowMs - startTimeMs) / 1000;
      elapsedSceneSeconds = elapsedSeconds;
      const showConjunctions = useSceneStore.getState().conjunctionPaths && !earthOnlyRef.current && currentModeRef.current !== "HELIO";
      conjunctionPolylines.show = showConjunctions;
      conjunctionMarkers.show = showConjunctions;
      conjunctionLabels.show = showConjunctions;
      conjOrbitPolylines.show = showConjunctions;
      const showWeather = useSceneStore.getState().spaceWeather && !earthOnlyRef.current && currentModeRef.current !== "HELIO";
      particleCollection.show = showWeather && currentModeRef.current === "STORM";
      magnetosphere.show = showWeather && currentModeRef.current === "STORM";
      auroraCapEntities.forEach((entity) => { entity.show = showWeather; });

      if (currentModeRef.current === "HELIO" && !earthOnlyRef.current) {
        catalogModels.update(activeSatAnimStates, false);
        updateHelioVisuals(time, deltaSeconds, true);
        presentation.update(time, deltaSeconds);
        return;
      }
      if (earthOnlyRef.current) {
        catalogModels.update(activeSatAnimStates, false);
        presentation.update(time, deltaSeconds);
        if (useSceneStore.getState().autoRotate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && nowMs - earthOnlyLastInteractionMs > EARTH_ONLY_IDLE_DELAY_MS) {
          viewer.camera.rotate(Cartesian3.UNIT_Z, CesiumMath.toRadians(EARTH_ONLY_ROTATION_DEGREES_PER_SECOND) * deltaSeconds);
        }
        return;
      }

      // Batched object silhouettes; SGP4 runs off the UI thread.
      const wallTime = Date.now();
      const live = useAuroraStore.getState().feedLastUpdated.satellites !== null;
      const mode = currentModeRef.current;
      const settings = useSceneStore.getState();
      const snapshot = catalogWindow;
      const usable = !!snapshot && snapshot.generation === catalogGeneration && wallTime <= snapshot.endMs + 1000;
      const fraction = snapshot ? clamp((wallTime - snapshot.startMs) / (snapshot.endMs - snapshot.startMs), 0, 1) : 0;
      const stride = settings.catalogDensity === "all" ? 1 : Math.max(1, Math.ceil(activeSatAnimStates.length / 900));
      let plotted = 0;
      satelliteOccluder.cameraPosition = viewer.camera.positionWC;
      activeSatAnimStates.forEach((state, index) => {
        const selected = state.satellite.noradId === selectedSatelliteNoradId;
        const pair = selectedConjSatIds.has(state.satellite.noradId);
        const offset = index * 6;
        const eligible = !live || (usable && Number.isFinite(snapshot!.positions[offset]));
        if (!settings.satellitesOn || !eligible) { state.point.show = false; return; }
        if (live && snapshot) {
          const p = snapshot.positions;
          Cartesian3.fromElements(
            p[offset] + (p[offset + 3] - p[offset]) * fraction,
            p[offset + 1] + (p[offset + 4] - p[offset + 1]) * fraction,
            p[offset + 2] + (p[offset + 5] - p[offset + 2]) * fraction,
            state.positionScratch);
        } else Cartesian3.clone(getSatellitePositionAtOffset(state, elapsedSeconds, 0), state.positionScratch);
        state.point.position = state.positionScratch;
        if (!satelliteOccluder.isPointVisible(state.positionScratch)) {
          state.point.show = false;
          return;
        }
        // Evaluate proximity from the current propagated position, even for
        // objects omitted by the wide-view density limit.
        state.point.show = selected || pair || index % stride === 0 || Cartesian3.distanceSquared(state.positionScratch, viewer.camera.positionWC) < 1000000 ** 2;
        if (!state.point.show) return;
        plotted++;
        state.point.scale = selected || pair ? 1.4 : 1;
        state.point.color = Color.WHITE;
        // Close inspection uses the existing representative 3D model and selection ring.
        if (selected) state.point.show = false;
      });
      if (nowMs - lastCatalogStatsMs > 1000) {
        lastCatalogStatsMs = nowMs;
        const eligible = live ? snapshot?.valid ?? 0 : activeSatAnimStates.length;
        useSceneStore.getState().setCatalogStats({ total: activeSatAnimStates.length, eligible, plotted,
          withheld: live && snapshot ? activeSatAnimStates.length - eligible : 0,
          limited: usable || !live ? Math.max(0, eligible - plotted) : 0,
          computeMs: snapshot?.computeMs ?? 0,
          state: !live ? "demo" : catalogWorkerFailed ? "error" : !snapshot ? "loading" : usable ? "ready" : "late" });
      }
      catalogModels.update(activeSatAnimStates, settings.satellitesOn);
      presentation.update(time, deltaSeconds);

      if (earthOnlyRef.current || currentModeRef.current === "HELIO") {
        selectedSatelliteRing.show = false;
      } else if (selectedSatelliteNoradId !== null) {
        const selected = satAnimByNorad.get(selectedSatelliteNoradId);
        selectedSatelliteRing.show = Boolean(settings.satellitesOn && selected && satelliteOccluder.isPointVisible(selected.point.position) && (!live || propagatedPosition(selected.satellite)));
        if (selected) Cartesian3.clone(selected.point.position, selectedRingPosition);
      } else {
        selectedSatelliteRing.show = false;
      }

      // Live paths are sampled in TEME, then rotated together at the current UTC.
      // Never connect current positions and present that chord as a future encounter.
      conjunctionPolylines.modelMatrix = live
        ? Matrix4.fromRotationTranslation(Matrix3.fromRotationZ(-gstime(new Date(wallTime))))
        : Matrix4.IDENTITY;
      const activePairId = conjunctionVisualState.some(v => v.conjunction.id === selectedConjunctionId) ? selectedConjunctionId : null;
      conjunctionVisualState.forEach((visual) => {
        if (!showConjunctions) return;
        visual.object2Marker.show = visual.object2Label.show = false;
        const object1State = satAnimByNorad.get(visual.sat1NoradId);
        const object2State = satAnimByNorad.get(visual.sat2NoradId);
        if (!object1State && !object2State) {
          visual.object1Arc.show = false;
          visual.object2Arc.show = false;
          visual.missDistanceLine.show = false;
          visual.marker.show = false;
          visual.label.show = false;
          return;
        }

        const isSelected = selectedConjunctionId === visual.conjunction.id;
        const style = conjunctionPairStyle(visual.conjunction.id, activePairId, useSceneStore.getState().conjunctionFocus);
        const baseColor = visual.pairColor.withAlpha(style.opacity);
        if (live) {
          const at = new Date(wallTime);
          const minute = Math.floor(wallTime / 60000);
          const object1Elements = object1State ? orbitalElements(object1State.satellite) : null;
          const object2Elements = object2State ? orbitalElements(object2State.satellite) : null;
          const cached = visual.orbitCache;
          if (!cached || cached.minute !== minute || cached.object1Elements !== object1Elements || cached.object2Elements !== object2Elements) {
            visual.object1Arc.positions = object1State ? predictedOrbit(object1State.satellite, at, 240, "orbital") : [];
            visual.object2Arc.positions = object2State ? predictedOrbit(object2State.satellite, at, 240, "orbital") : [];
            visual.orbitCache = { minute, object1Elements, object2Elements };
          }
          visual.object1Arc.show = !!object1State && hasCurrentElements(object1State.satellite, at) && visual.object1Arc.positions.length > 1;
          visual.object2Arc.show = !!object2State && hasCurrentElements(object2State.satellite, at) && visual.object2Arc.positions.length > 1;
          for (const arc of [visual.object1Arc, visual.object2Arc]) {
            arc.width = style.width;
            (arc.material.uniforms as { color: Color }).color = baseColor.clone();
          }
          // Public catalog elements do not establish the CDM encounter geometry.
          visual.missDistanceLine.show = false;
          const anchor = isSelected && object1State ? propagatedPosition(object1State.satellite, at) : null;
          const anchor2 = isSelected && object2State ? propagatedPosition(object2State.satellite, at) : null;
          visual.label.show = anchor !== null;
          visual.marker.show = anchor !== null;
          visual.object2Label.show = visual.object2Marker.show = anchor2 !== null;
          if (anchor) {
            visual.marker.position = anchor;
            visual.marker.color = baseColor.clone();
            visual.marker.pixelSize = 8;
            visual.label.position = anchor;
            visual.label.text = `${visual.pairNumber} A · ${conjunctionObjectLabel(visual.conjunction.object1)}`;
            visual.label.fillColor = baseColor.clone();
          }
          if (anchor2) {
            visual.object2Marker.position = anchor2;
            visual.object2Marker.color = baseColor.clone();
            visual.object2Label.position = anchor2;
            visual.object2Label.text = `${visual.pairNumber} B · ${conjunctionObjectLabel(visual.conjunction.object2)}`;
            visual.object2Label.fillColor = baseColor.clone();
          }
          return;
        }
        // Partial demo pairs can still show their available illustrative orbit.
        if (!object1State || !object2State) {
          visual.object1Arc.positions = object1State ? createOrbitPositions(object1State.satellite) : [];
          visual.object2Arc.positions = object2State ? createOrbitPositions(object2State.satellite) : [];
          visual.object1Arc.show = !!object1State;
          visual.object2Arc.show = !!object2State;
          visual.missDistanceLine.show = visual.marker.show = visual.label.show = false;
          return;
        }
        const tcaDate = visual.conjunction.tca instanceof Date ? visual.conjunction.tca : new Date(visual.conjunction.tca);
        const timeUntilTcaSeconds = Math.max(0, (tcaDate.getTime() - Date.now()) / 1000);
        const object1TcaPosition = getSatellitePositionAtOffset(object1State, elapsedSeconds, timeUntilTcaSeconds);
        const object2TcaPosition = getSatellitePositionAtOffset(object2State, elapsedSeconds, timeUntilTcaSeconds);
        const midpoint = Cartesian3.midpoint(object1TcaPosition, object2TcaPosition, new Cartesian3());
        const midpointMagnitude = Cartesian3.magnitude(midpoint);
        const labelDirection = midpointMagnitude < 1
          ? Cartesian3.UNIT_Z
          : Cartesian3.normalize(midpoint, new Cartesian3());
        const labelPosition = Cartesian3.multiplyByScalar(
          labelDirection,
          Math.max(midpointMagnitude, earthR) + 240_000,
          new Cartesian3()
        );
        const pulse = 0.5 + 0.5 * Math.sin(timeSeconds * 4.5);
        const lineWidth = style.width;

        visual.object1Arc.show = true;
        visual.object2Arc.show = true;
        visual.missDistanceLine.show = isSelected;
        visual.marker.show = isSelected;
        visual.label.show = isSelected;

        visual.object1Arc.positions = createConjunctionOrbitArcPositions(object1State, elapsedSeconds, timeUntilTcaSeconds);
        visual.object2Arc.positions = createConjunctionOrbitArcPositions(object2State, elapsedSeconds, timeUntilTcaSeconds);
        visual.missDistanceLine.positions = [object1TcaPosition, object2TcaPosition];
        visual.object1Arc.width = lineWidth;
        visual.object2Arc.width = lineWidth;
        visual.missDistanceLine.width = lineWidth;
        (visual.object1Arc.material.uniforms as { color: Color }).color = baseColor.clone();
        (visual.object2Arc.material.uniforms as { color: Color }).color = baseColor.clone();
        (visual.missDistanceLine.material.uniforms as { color: Color }).color = baseColor.clone();
        visual.marker.position = midpoint;
        visual.marker.pixelSize = (visual.riskLevel === "watch" ? 9 : 11) + pulse * 3;
        visual.marker.color = baseColor.withAlpha(clamp(baseColor.alpha * (0.75 + pulse * 0.35), 0.5, 1));
        visual.label.position = labelPosition;
        visual.label.text = `Illustrative TCA ${formatDurationToTca(visual.conjunction.tca)}`;
        visual.label.fillColor = baseColor.clone();
      });
      if (showConjunctions) {
        const visible = conjunctionVisualState.reduce((count, visual) => count + Number(visual.object1Arc.show) + Number(visual.object2Arc.show), 0);
        useSceneStore.getState().setConjunctionPathCount(visible, conjunctionsRef.current.length * 2);
        if (useSceneStore.getState().conjunctionFocus && activePairId) {
          for (const visual of conjunctionVisualState) {
            if (conjunctionPairStyle(visual.conjunction.id, activePairId, true).visible) continue;
            visual.object1Arc.show = visual.object2Arc.show = visual.missDistanceLine.show = false;
            visual.marker.show = visual.object2Marker.show = visual.label.show = visual.object2Label.show = false;
          }
        }
      }

      const latestSpaceWeather = spaceWeatherRef.current;
      const isStormMode = isStormModeActive(currentModeRef.current, latestSpaceWeather.kpIndex);
      const flowSpeed = latestSpaceWeather.solarWindSpeed * 18_000 * (isStormMode ? 2 : 1);
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


    };

    const unsubscribeStore = useAuroraStore.subscribe((state, previousState) => {
      currentModeRef.current = state.currentMode;
      earthOnlyRef.current = state.earthOnlyMode;
      helioSimulationSecondsRef.current = state.helioSimulationSeconds;
      helioPlaybackRateRef.current = state.helioPlaybackRate;
      helioBurstIntensityRef.current = state.helioBurstIntensity;
      helioScenarioVersionRef.current = state.helioScenarioVersion;

      if (
        state.currentMode === "HELIO" &&
        state.helioSimulationSeconds === 0 &&
        previousState.helioSimulationSeconds !== 0
      ) {
        helioSimulationBaseDate = new Date();
        lastHelioStoreSyncMs = -Number.POSITIVE_INFINITY;
        lastHelioStoreValue = -1;
        updateHelioVisuals(JulianDate.now(), 0, false);
      }

      if (
        state.currentMode === "HELIO" &&
        state.helioScenarioVersion !== previousState.helioScenarioVersion
      ) {
        helioSimulationBaseDate = new Date();
        regenerateHelioScenario();
        lastHelioStoreSyncMs = -Number.POSITIVE_INFINITY;
        lastHelioStoreValue = -1;
        updateHelioVisuals(JulianDate.now(), 0, false);
      }

      if (state.earthOnlyMode !== previousState.earthOnlyMode) {
        applyModeVisibility(state.currentMode);
        if (state.earthOnlyMode) {
          earthOnlyLastInteractionMs = performance.now();
          flyCameraToEarthOnly();
        } else if (state.currentMode === "HELIO") {
          updateHelioVisuals(JulianDate.now(), 0, false);
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
        if (state.currentMode === "HELIO" && previousState.currentMode !== "HELIO") {
          helioSimulationBaseDate = new Date();
          regenerateHelioScenario();
          helioSimulationSecondsRef.current = 0;
          helioPlaybackRateRef.current = 0;
          lastHelioStoreSyncMs = -Number.POSITIVE_INFINITY;
          lastHelioStoreValue = -1;
          resetHelioSimulation();
          updateHelioVisuals(JulianDate.now(), 0, false);
        }
        applyModeVisibility(state.currentMode);
        if (!state.earthOnlyMode) {
          transitionCameraForMode(state.currentMode, previousState.currentMode);
        }
      }

      const nextSatelliteNorad = state.selectedSatellite?.noradId ?? null;
      const previousSatelliteNorad = previousState.selectedSatellite?.noradId ?? null;
      if (nextSatelliteNorad !== previousSatelliteNorad) {
        selectedSatelliteNoradId = nextSatelliteNorad;
        if (!useSceneStore.getState().following && nextSatelliteNorad !== null && state.currentMode !== "HELIO" && !state.earthOnlyMode) {
          flyCameraToSatellite(nextSatelliteNorad);
        }
      }

      const prevConjId = selectedConjunctionId;
      selectedConjunctionId = state.selectedConjunction?.id ?? null;

      if (selectedConjunctionId !== prevConjId) {
        conjOrbitPolylines.removeAll();
        selectedConjSatIds.clear();

        if (state.selectedConjunction) {
          const findByRef = (ref: { noradId: number; name: string }): SatelliteAnimState | undefined => {
            const byId = satAnimByNorad.get(Number(ref.noradId));
            if (byId) return byId;
            // Fallback: search by name
            for (const s of satAnimByNorad.values()) {
              if (s.satellite.name === ref.name) return s;
            }
            return undefined;
          };

          const match1 = findByRef(state.selectedConjunction.object1);
          const match2 = findByRef(state.selectedConjunction.object2);
          if (!match1 && !match2) {
            console.warn("[AURORA] Conjunction satellites not in feed:",
              state.selectedConjunction.object1.name, `(${state.selectedConjunction.object1.noradId})`,
              state.selectedConjunction.object2.name, `(${state.selectedConjunction.object2.noradId})`,
              "— orbital elements unavailable in the catalog and conjunction lookup"
            );
          }

          let flyTarget: number | null = null;

          for (const match of [match1, match2]) {
            if (match) {
              selectedConjSatIds.add(match.satellite.noradId);
              if (flyTarget === null) flyTarget = match.satellite.noradId;
            }
          }

          if (flyTarget !== null && state.activePanels.has("conjunction-detail") && state.currentMode !== "HELIO" && !state.earthOnlyMode) {
            flyCameraToSatellite(flyTarget);
          }
        }
      }
    });

    applyModeVisibility(currentModeRef.current);
    if (earthOnlyRef.current) {
      earthOnlyLastInteractionMs = performance.now();
      flyCameraToEarthOnly();
    } else if (currentModeRef.current === "HELIO") {
      helioSimulationBaseDate = new Date();
      regenerateHelioScenario();
      helioSimulationSecondsRef.current = 0;
      helioPlaybackRateRef.current = 0;
      lastHelioStoreSyncMs = -Number.POSITIVE_INFINITY;
      lastHelioStoreValue = -1;
      resetHelioSimulation();
      updateHelioVisuals(JulianDate.now(), 0, false);
      transitionCameraForMode("HELIO");
    }

    if (currentModeRef.current !== "HELIO") presentation.home();
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
    const pickChoices=(picks:{id?:any}[]):PickChoice[]=>{
      const found=new Map<string,PickChoice>();
      for(const {id} of picks){
        if(isSatellitePickPayload(id)){const satellite=id.satellite;found.set('sat:'+satellite.noradId,{id:'sat:'+satellite.noradId,name:satellite.name,detail:`Satellite · #${satellite.noradId}`,select:()=>{useAerospace.getState().set({selected:null,simulation:null,followedLaunchId:null});useAuroraStore.getState().closeAllPanels();setSelectedSatellite(satellite);}});}
        else if(id?.type==='conjunction'){const c=conjunctionsRef.current.find(c=>c.id===id.id);if(c)found.set(c.id,{id:c.id,name:'Conjunction pair',detail:c.id,select:()=>{useAuroraStore.getState().setSelectedConjunction(c,false);useSceneStore.getState().setOpsPanel('pairs');useExplorer.getState().set({catalogOpen:true});}});}
        else if(typeof id?.id==='string'){
          const key=id.id,state=useAerospace.getState();
          const camera=useEarth.getState().cameras.find(c=>c.id===key);
          if(camera&&useEarth.getState().camerasOn){found.set(key,{id:key,name:camera.name,detail:'Public traffic camera · Singapore',select:()=>{useAuroraStore.getState().closeAllPanels();useAerospace.getState().set({open:false});useExplorer.getState().set({catalogOpen:false,earthOpen:true});useEarth.getState().set({selected:key});}});continue;}

          const a=state.aircraft.find(a=>'air:'+a.id===key),l=state.launches.find(l=>'launch:'+l.id===key);
          if(a||l)found.set(key,{id:key,name:a?.name||l!.name,detail:a?`${a.model} · ${a.military?'Military-tagged aircraft':'Aircraft'}`:'Launch site',select:()=>{useAuroraStore.getState().closeAllPanels();state.set({selected:key,open:true,tab:a?'aircraft':'launches',simulation:null});}});
        }
      }
      return [...found.values()];
    };
    let lastHover=0;
    viewer.screenSpaceEventHandler.setInputAction((event:{endPosition:Cartesian2})=>{
      if(performance.now()-lastHover<100)return;lastHover=performance.now();
      const choices=pickChoices(viewer.scene.drillPick(event.endPosition,8,10,10));
      viewer.canvas.style.cursor=choices.length?'pointer':'';
      useExplorer.getState().set({hover:choices.length?{x:event.endPosition.x,y:event.endPosition.y,text:choices.length>1?`${choices.length} objects · click to choose`:choices[0].name}:null});
    },ScreenSpaceEventType.MOUSE_MOVE);
    // Selection is handled above with overlap disambiguation, not Cesium's default click.
    viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
    viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    let mouseDownPosition = { x: 0, y: 0 };
    viewer.screenSpaceEventHandler.setInputAction((event: { position: Cartesian2 }) => {
      mouseDownPosition = { x: event.position.x, y: event.position.y };
    }, ScreenSpaceEventType.LEFT_DOWN);

    viewer.screenSpaceEventHandler.setInputAction((event: { position: Cartesian2 }) => {
      const dx = event.position.x - mouseDownPosition.x;
      const dy = event.position.y - mouseDownPosition.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;
      const pickedList = viewer.scene.drillPick(event.position, 24, 12, 12);
      if(currentModeRef.current==='HELIO') {for(const p of pickedList){const id=getPickedHelioPlanetId(p.id);if(id){flyCameraToHelioPlanet(id);return;}}return;}
      const choices=pickChoices(pickedList);
      if(choices.length===1)choices[0].select();
      useExplorer.getState().set({choices:choices.length>1?choices:[],hover:null});
    }, ScreenSpaceEventType.LEFT_UP);

    const disposeAerospace = installAerospace(viewer);
    const disposeEarth = installEarth(viewer);
    return () => {
      disposeEarth();
      disposeAerospace();
      isDisposed = true;
      catalogWorker.terminate();
      catalogModels.dispose();
      presentation.dispose();
      syncSatellitesRef.current = null;
      syncConjunctionsRef.current = null;
      syncSpaceWeatherRef.current = null;
      viewer.scene.preRender.removeEventListener(onPreRender);
      viewer.canvas.removeEventListener("pointerdown", markEarthOnlyInteraction);
      viewer.canvas.removeEventListener("wheel", markEarthOnlyInteraction);
      viewer.canvas.removeEventListener("touchstart", markEarthOnlyInteraction);
      viewer.canvas.removeEventListener("touchmove", markEarthOnlyInteraction);
      viewer.canvas.removeEventListener("pointermove", onPointerMove);
      viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
      viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOWN);
      viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_UP);
      unsubscribeStore();
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, [resetHelioSimulation, setHelioPlaybackRate, setHelioSimulationSeconds, setSelectedSatellite]);

  useEffect(() => {
    satellitesRef.current = satellites;
    syncSatellitesRef.current?.(satellites);
    syncConjunctionsRef.current?.(conjunctionsRef.current);
  }, [satellites]);

  useEffect(() => {
    // Intentionally rebuild conjunction visuals only from conjunction updates.
    // Satellite positions are read from refs and the live scene state.
    conjunctionsRef.current = conjunctions;
    console.log(
      "rendering arcs for",
      conjunctions.length,
      "conjunctions",
      conjunctions.filter((c) => c.riskLevel !== "nominal").length,
      "non-nominal"
    );
    syncConjunctionsRef.current?.(conjunctions);
  }, [conjunctions]);

  useEffect(() => {
    spaceWeatherRef.current = spaceWeather;
    syncSpaceWeatherRef.current?.(spaceWeather);
  }, [spaceWeather]);

  return <div ref={containerRef} className="h-full w-full" />;
};
