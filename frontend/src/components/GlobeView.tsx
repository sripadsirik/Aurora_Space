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
  ImageMaterialProperty,
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
  PolylineDashMaterialProperty,
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
  createOrbitArcPositions,
  createOrbitRingPositions,
  formatHelioArrivalLabel,
  HELIO_CME_DURATION_SECONDS,
  getHelioOrbitAngle,
  HELIO_AU_SCENE_UNITS,
  HELIO_L1_OFFSET,
  HELIO_ORBIT_RADII,
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
const HELIO_CME_PROGRESS_START = 0.4;
const HELIO_CME_PROGRESS_END = 1.2;
const HELIO_ORBIT_TIME_SCALE_SECONDS = 12 * 3600;
const HELIO_PLAYBACK_BASE_RATE = 1;
const HELIO_ORBIT_DASH_PATTERN = Number.parseInt("1111111100000000", 2);
const HELIO_SIM_SYNC_INTERVAL_MS = 120;
const HELIO_PLANET_RADII = {
  earth: 360_000,
  venus: 320_000,
  mars: 290_000
} as const;

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

const createBezierArcPositions = (start: Cartesian3, control: Cartesian3, end: Cartesian3, intermediatePoints = 8): Cartesian3[] => {
  const segments = intermediatePoints + 1;
  const positions: Cartesian3[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const u = 1 - t;
    positions.push(new Cartesian3(
      u * u * start.x + 2 * u * t * control.x + t * t * end.x,
      u * u * start.y + 2 * u * t * control.y + t * t * end.y,
      u * u * start.z + 2 * u * t * control.z + t * t * end.z
    ));
  }

  return positions;
};

const createFireConeFrontPositions = (
  sunToEarth: Cartesian3,
  right: Cartesian3,
  up: Cartesian3,
  length: number,
  halfAngle: number,
  timeSeconds: number,
  flareScale: number,
  liftScale: number,
  segments = 18
): Cartesian3[] => {
  const positions: Cartesian3[] = [];
  const spread = Math.tan(halfAngle);

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const lateralFactor = CesiumMath.lerp(-1, 1, t);
    const centerBias = 1 - Math.pow(Math.abs(lateralFactor), 1.45);
    const tongue = Math.max(0, Math.sin(timeSeconds * 4.4 + t * 19)) * centerBias;
    const flutter = Math.sin(timeSeconds * 10.5 + t * 31) * 0.035;
    const forwardScale = clamp(0.8 + centerBias * 0.14 + tongue * (0.22 * flareScale) + flutter, 0.62, 1.28);
    const verticalFactor = Math.sin(timeSeconds * 3.8 + t * 13) * centerBias * liftScale;
    const direction = new Cartesian3(
      sunToEarth.x + lateralFactor * spread * right.x + verticalFactor * up.x,
      sunToEarth.y + lateralFactor * spread * right.y + verticalFactor * up.y,
      sunToEarth.z + lateralFactor * spread * right.z + verticalFactor * up.z
    );

    Cartesian3.normalize(direction, direction);
    positions.push(Cartesian3.multiplyByScalar(direction, length * forwardScale, new Cartesian3()));
  }

  return positions;
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

    const regenerateHelioScenario = (): void => {
      const earthAtLaunch = positionOnHelioOrbit(
        HELIO_ORBIT_RADII.earth,
        getHelioOrbitAngle(helioSimulationBaseDate, 365.25, HELIO_PHASES.earth)
      );
      const baseDirection = Cartesian3.normalize(earthAtLaunch, new Cartesian3());
      const worldUp = Math.abs(Cartesian3.dot(baseDirection, Cartesian3.UNIT_Z)) > 0.98 ? Cartesian3.UNIT_Y : Cartesian3.UNIT_Z;
      const baseRight = Cartesian3.normalize(Cartesian3.cross(baseDirection, worldUp, new Cartesian3()), new Cartesian3());
      const baseUp = Cartesian3.normalize(Cartesian3.cross(baseRight, baseDirection, new Cartesian3()), new Cartesian3());
      const lateralAim = randomInRange(-0.08, 0.08);
      const verticalAim = randomInRange(-0.03, 0.03);

      helioCmeLaunchDirection = Cartesian3.normalize(new Cartesian3(
        baseDirection.x + baseRight.x * lateralAim + baseUp.x * verticalAim,
        baseDirection.y + baseRight.y * lateralAim + baseUp.y * verticalAim,
        baseDirection.z + baseRight.z * lateralAim + baseUp.z * verticalAim
      ), helioCmeLaunchDirection);
      helioCmeLaunchRight = Cartesian3.normalize(Cartesian3.cross(helioCmeLaunchDirection, worldUp, helioCmeLaunchRight), helioCmeLaunchRight);
      if (Cartesian3.magnitudeSquared(helioCmeLaunchRight) < 1e-6) {
        helioCmeLaunchRight = Cartesian3.normalize(Cartesian3.cross(helioCmeLaunchDirection, Cartesian3.UNIT_Y, helioCmeLaunchRight), helioCmeLaunchRight);
      }
      helioCmeLaunchUp = Cartesian3.normalize(Cartesian3.cross(helioCmeLaunchRight, helioCmeLaunchDirection, helioCmeLaunchUp), helioCmeLaunchUp);
      helioCmeCurveRight = randomInRange(-0.12, 0.12);
      helioCmeCurveUp = randomInRange(-0.045, 0.045);
      helioCmeSpreadScale = randomInRange(0.92, 1.14);
      helioCmeFlareScale = randomInRange(0.92, 1.22);
      helioCmeDensityTwist = randomInRange(-0.1, 0.1);
    };

    const syncHelioSimulationState = (force = false): void => {
      const nowMs = performance.now();
      if (!force && nowMs - lastHelioStoreSyncMs < HELIO_SIM_SYNC_INTERVAL_MS) return;
      lastHelioStoreSyncMs = nowMs;
      setHelioSimulationSeconds(helioSimulationSecondsRef.current);
    };
    regenerateHelioScenario();

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

    const getHelioPlanetAngle = (orbitalPeriodDays: number, phase: number): number =>
      getHelioOrbitAngle(getHelioSimulationDate(), orbitalPeriodDays, phase);
    const getHelioEarthAngle = (): number => getHelioPlanetAngle(365.25, HELIO_PHASES.earth);
    const getHelioElapsedSeconds = (): number => helioSimulationSecondsRef.current;
    const getHelioCmeProgress = (): number =>
      clamp(
        HELIO_CME_PROGRESS_START + (helioSimulationSecondsRef.current / HELIO_CME_DURATION_SECONDS) * (HELIO_CME_PROGRESS_END - HELIO_CME_PROGRESS_START),
        HELIO_CME_PROGRESS_START,
        HELIO_CME_PROGRESS_END
      );
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
        const coneLength = earthDistance * getHelioCmeProgress() + HELIO_AU_SCENE_UNITS * 0.07;
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
      const cmeProgress = getHelioCmeProgress();
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
        const emberProgress = (getHelioCmeProgress() * 0.52 + ember.progressOffset + flameTime * 0.038 * ember.speedScale) % 1.16;
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

    let lastFrameMs = performance.now();
    const startTimeMs = performance.now();
    const onPreRender = (_scene: unknown, time: JulianDate): void => {
      const nowMs = performance.now();
      const deltaSeconds = Math.min((nowMs - lastFrameMs) / 1000, 0.12);
      lastFrameMs = nowMs;
      const timeSeconds = JulianDate.toDate(time).getTime() / 1000;
      const elapsedSeconds = (nowMs - startTimeMs) / 1000;

      if (currentModeRef.current === "HELIO") {
        updateHelioVisuals(time, deltaSeconds, true);
      }

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
        updateHelioVisuals(JulianDate.now(), 0, false);
      }

      if (
        state.currentMode === "HELIO" &&
        state.helioScenarioVersion !== previousState.helioScenarioVersion
      ) {
        helioSimulationBaseDate = new Date();
        regenerateHelioScenario();
        lastHelioStoreSyncMs = -Number.POSITIVE_INFINITY;
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
      helioSimulationBaseDate = new Date();
      regenerateHelioScenario();
      helioSimulationSecondsRef.current = 0;
      helioPlaybackRateRef.current = 0;
      lastHelioStoreSyncMs = -Number.POSITIVE_INFINITY;
      resetHelioSimulation();
      updateHelioVisuals(JulianDate.now(), 0, false);
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
      if (currentModeRef.current === "HELIO") {
        const helioPlanetId = getPickedHelioPlanetId(pickedWithId.id);
        if (helioPlanetId) {
          flyCameraToHelioPlanet(helioPlanetId);
          return;
        }
      }
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
