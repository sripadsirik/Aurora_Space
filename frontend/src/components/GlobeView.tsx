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

/** Build an arc between two satellite positions using spherical interpolation (stays above earth) */
const createArcPositions = (start: Cartesian3, end: Cartesian3, segments = 32): Cartesian3[] => {
  const startMag = Cartesian3.magnitude(start);
  const endMag = Cartesian3.magnitude(end);

  // Guard: if either point is at origin, just return a simple two-point line
  if (startMag < 1 || endMag < 1) {
    return [start, end];
  }

  const positions: Cartesian3[] = [];

  const startNorm = new Cartesian3(start.x / startMag, start.y / startMag, start.z / startMag);
  const endNorm = new Cartesian3(end.x / endMag, end.y / endMag, end.z / endMag);

  const dot = clamp(startNorm.x * endNorm.x + startNorm.y * endNorm.y + startNorm.z * endNorm.z, -1, 1);
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;

    let dirX: number, dirY: number, dirZ: number;

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
    const r = radius * bow;

    const mag = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
    const scale = mag > 0 ? r / mag : 0;
    positions.push(new Cartesian3(dirX * scale, dirY * scale, dirZ * scale));
  }
  return positions;
};

const AURORA_COLOR = Color.fromCssColorString("#00ff96");
const ORANGE_COLOR = Color.fromCssColorString("#ff6600");
const RED_COLOR = Color.fromCssColorString("#ff0000");

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const randomInRange = (min: number, max: number): number => min + Math.random() * (max - min);

const computeSolarWindFrame = (time: JulianDate, earthR: number): SolarWindFrame => {
  const sunPos = Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time);
  const sunDir = Cartesian3.normalize(sunPos, new Cartesian3());
  const flowDir = Cartesian3.negate(sunDir, new Cartesian3());
  const spawnOrigin = Cartesian3.multiplyByScalar(sunDir, earthR * 25, new Cartesian3());
  const streamEnd = Cartesian3.multiplyByScalar(sunDir, -earthR * 8, new Cartesian3());

  const upVector = Math.abs(Cartesian3.dot(sunDir, Cartesian3.UNIT_Z)) > 0.95 ? Cartesian3.UNIT_Y : Cartesian3.UNIT_Z;
  const spreadAxisA = Cartesian3.normalize(Cartesian3.cross(sunDir, upVector, new Cartesian3()), new Cartesian3());
  const spreadAxisB = Cartesian3.normalize(Cartesian3.cross(sunDir, spreadAxisA, new Cartesian3()), new Cartesian3());

  return {
    sunDir,
    flowDir,
    spawnOrigin,
    streamEnd,
    spreadAxisA,
    spreadAxisB
  };
};

const setParticleOnSolarWindStream = (
  particle: SolarWindParticle,
  frame: SolarWindFrame,
  streamSpread: number,
  alongFlowOffset: number
): void => {
  const spreadA = randomInRange(-streamSpread, streamSpread);
  const spreadB = randomInRange(-streamSpread, streamSpread);

  particle.x =
    frame.spawnOrigin.x +
    frame.flowDir.x * alongFlowOffset +
    frame.spreadAxisA.x * spreadA +
    frame.spreadAxisB.x * spreadB;
  particle.y =
    frame.spawnOrigin.y +
    frame.flowDir.y * alongFlowOffset +
    frame.spreadAxisA.y * spreadA +
    frame.spreadAxisB.y * spreadB;
  particle.z =
    frame.spawnOrigin.z +
    frame.flowDir.z * alongFlowOffset +
    frame.spreadAxisA.z * spreadA +
    frame.spreadAxisB.z * spreadB;
};

const isSatellitePickPayload = (value: unknown): value is SatellitePickPayload => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.type === "satellite" && typeof record.satellite === "object" && record.satellite !== null;
};

const createAuroraCapHierarchy = (isNorth: boolean, radiusDeg: number, pointCount = 96): PolygonHierarchy => {
  const positions: Cartesian3[] = [];
  const poleSign = isNorth ? 1 : -1;

  for (let index = 0; index <= pointCount; index += 1) {
    const fraction = index / pointCount;
    const theta = fraction * CesiumMath.TWO_PI;
    const wobble = 1 + 0.12 * Math.sin(theta * 3);
    const colatitude = radiusDeg * wobble;
    const latitude = poleSign * (90 - colatitude);
    const longitude = CesiumMath.toDegrees(theta) - 180;

    positions.push(Cartesian3.fromDegrees(longitude, latitude));
  }

  return new PolygonHierarchy(positions);
};

const createAuroraMaterial = (minAlpha: number, maxAlpha: number): ColorMaterialProperty =>
  new ColorMaterialProperty(
    new CallbackProperty(() => {
      const phase = 0.5 + 0.5 * Math.sin(performance.now() * 0.0018);
      const alpha = minAlpha + (maxAlpha - minAlpha) * phase;
      return AURORA_COLOR.withAlpha(alpha);
    }, false)
  );

export const GlobeView = ({ satellites, conjunctions, spaceWeather }: GlobeViewProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setSelectedSatellite = useAuroraStore((state) => state.setSelectedSatellite);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

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

    // Completely disable all default event types first
    controller.rotateEventTypes = [];
    controller.translateEventTypes = [];
    controller.zoomEventTypes = [];
    controller.tiltEventTypes = [];
    controller.lookEventTypes = [];

    // Left drag + middle drag: rotate/orbit around the globe (earth stays centered)
    controller.rotateEventTypes = [
      CameraEventType.LEFT_DRAG,
      CameraEventType.MIDDLE_DRAG
    ];
    // Translate disabled — prevents panning away from earth
    controller.translateEventTypes = [];
    // Scroll wheel + pinch: zoom
    controller.zoomEventTypes = [
      CameraEventType.WHEEL,
      CameraEventType.PINCH
    ];
    controller.zoomFactor = 2.0;
    // Right mouse button: tilt/yaw to view satellites parallel to ground
    controller.tiltEventTypes = CameraEventType.RIGHT_DRAG;

    // Zoom limits: allow close-in terrain/building inspection while keeping far-out bounds.
    controller.minimumZoomDistance = 25;
    controller.maximumZoomDistance = 200_000_000; // ~200,000km out

    // Start looking at earth from space, centered
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(0, 20, 35_000_000),
      orientation: {
        heading: 0,
        pitch: CesiumMath.toRadians(-90),
        roll: 0
      }
    });

    let isDisposed = false;

    createWorldTerrainAsync({
      requestWaterMask: true,
      requestVertexNormals: true
    }).then((terrainProvider) => {
      if (isDisposed || viewer.isDestroyed()) return;
      viewer.terrainProvider = terrainProvider;
    }).catch((err) => {
      console.error("[AURORA] Failed to load terrain", err);
    });

    IonImageryProvider.fromAssetId(2).then((provider) => {
      if (isDisposed || viewer.isDestroyed()) return;
      viewer.imageryLayers.addImageryProvider(provider);
    }).catch((err) => {
      console.error("[AURORA] Failed to load imagery", err);
    });

    createOsmBuildingsAsync().then((tileset) => {
      if (isDisposed || viewer.isDestroyed()) return;
      viewer.scene.primitives.add(tileset);
    }).catch((err) => {
      console.error("[AURORA] Failed to load OSM buildings", err);
    });

    const earthR = earthRadiusMeters;

    const satellitePoints = viewer.scene.primitives.add(
      new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE_AND_TRANSLUCENT })
    );

    const criticalPoints: PointPrimitive[] = [];
    const satAnimStates: SatelliteAnimState[] = [];
    const satAnimByNorad = new Map<number, SatelliteAnimState>();
    let selectedSatelliteNoradId = useAuroraStore.getState().selectedSatellite?.noradId ?? null;
    let selectedConjunctionId = useAuroraStore.getState().selectedConjunction?.id ?? null;

    satellites.forEach((satellite) => {
      const { radius, inclination, ascendingNode } = getOrbitParams(satellite);
      const period = getOrbitalPeriod(radius);
      const initialTheta = CesiumMath.toRadians(satellite.lon + 180);
      const startPos = orbitPoint(initialTheta, radius, inclination, ascendingNode);

      const point = satellitePoints.add({
        position: startPos,
        pixelSize: satellite.riskLevel === "critical" ? 10 : 6,
        color: riskColorMap[satellite.riskLevel].clone(),
        outlineColor: Color.WHITE.withAlpha(0.25),
        outlineWidth: satellite.riskLevel === "critical" ? 2 : 1,
        disableDepthTestDistance: 0.0,
        id: {
          type: "satellite",
          satellite
        }
      });

      const state: SatelliteAnimState = {
        point,
        satellite,
        radius,
        inclination,
        ascendingNode,
        period,
        initialTheta
      };
      satAnimStates.push(state);
      satAnimByNorad.set(satellite.noradId, state);

      if (satellite.riskLevel === "critical") {
        criticalPoints.push(point);
      }
    });

    const flyCameraToSatellite = (noradId: number): void => {
      const state = satAnimByNorad.get(noradId);
      if (!state) return;

      const radialDirection = Cartesian3.normalize(state.point.position, new Cartesian3());
      const offset = Cartesian3.multiplyByScalar(radialDirection, earthR * 2.5, new Cartesian3());
      const destination = Cartesian3.add(state.point.position, offset, new Cartesian3());

      viewer.camera.flyTo({
        destination,
        duration: 1.25,
        easingFunction: EasingFunction.QUADRATIC_OUT
      });
    };

    const selectedRingPosition = new Cartesian3();
    const selectedSatelliteRing = viewer.entities.add({
      name: "selected-satellite-ring",
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

    if (selectedSatelliteNoradId !== null) {
      flyCameraToSatellite(selectedSatelliteNoradId);
    }

    const unsubscribeStore = useAuroraStore.subscribe((state, previousState) => {
      const nextSatelliteNorad = state.selectedSatellite?.noradId ?? null;
      const previousSatelliteNorad = previousState.selectedSatellite?.noradId ?? null;

      if (nextSatelliteNorad !== previousSatelliteNorad) {
        selectedSatelliteNoradId = nextSatelliteNorad;
        if (nextSatelliteNorad !== null) {
          flyCameraToSatellite(nextSatelliteNorad);
        }
      }

      selectedConjunctionId = state.selectedConjunction?.id ?? null;
    });

    viewer.scene.primitives.add(
      new Primitive({
        geometryInstances: satellites.map(
          (satellite) =>
            new GeometryInstance({
              geometry: new PolylineGeometry({
                positions: createOrbitPositions(satellite),
                width: 1,
                vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT
              })
            })
        ),
        appearance: new PolylineMaterialAppearance({
          material: Material.fromType("PolylineDash", {
            color: Color.fromCssColorString("#00d4ff").withAlpha(0.18),
            gapColor: Color.TRANSPARENT,
            dashLength: 24,
            dashPattern: 255
          })
        }),
        asynchronous: false
      })
    );

    const conjunctionLines = viewer.scene.primitives.add(new PolylineCollection());

    const conjunctionLineState: ConjunctionLineState[] = [];

    conjunctions.forEach((conjunction) => {
      const first = satAnimByNorad.get(conjunction.object1.noradId);
      const second = satAnimByNorad.get(conjunction.object2.noradId);

      if (!first || !second) {
        return;
      }

      const polyline = conjunctionLines.add({
        positions: [first.point.position, second.point.position],
        show: false,
        width: 2,
        material: Material.fromType("Color", {
          color: ORANGE_COLOR.withAlpha(0.8)
        })
      });

      conjunctionLineState.push({
        conjunction,
        polyline,
        sat1NoradId: conjunction.object1.noradId,
        sat2NoradId: conjunction.object2.noradId
      });
    });

    const auroraRadiusDeg = kpToAuroraRadiusDegrees(spaceWeather.kpIndex);

    viewer.entities.add({
      name: "aurora-north-outer",
      polygon: {
        hierarchy: createAuroraCapHierarchy(true, auroraRadiusDeg),
        material: createAuroraMaterial(0.07, 0.16),
        perPositionHeight: false
      }
    });

    viewer.entities.add({
      name: "aurora-north-inner",
      polygon: {
        hierarchy: createAuroraCapHierarchy(true, auroraRadiusDeg * 0.68),
        material: createAuroraMaterial(0.17, 0.35),
        perPositionHeight: false
      }
    });

    viewer.entities.add({
      name: "aurora-south-outer",
      polygon: {
        hierarchy: createAuroraCapHierarchy(false, auroraRadiusDeg),
        material: createAuroraMaterial(0.07, 0.16),
        perPositionHeight: false
      }
    });

    viewer.entities.add({
      name: "aurora-south-inner",
      polygon: {
        hierarchy: createAuroraCapHierarchy(false, auroraRadiusDeg * 0.68),
        material: createAuroraMaterial(0.17, 0.35),
        perPositionHeight: false
      }
    });

    viewer.scene.primitives.add(
      new Primitive({
        geometryInstances: new GeometryInstance({
          geometry: new EllipsoidGeometry({
            radii: new Cartesian3(earthR * 9, earthR * 10, earthR * 10),
            vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
            stackPartitions: 64,
            slicePartitions: 64
          }),
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(new Color(100 / 255, 180 / 255, 1, 0.06))
          }
        }),
        appearance: new PerInstanceColorAppearance({
          translucent: true,
          closed: true
        }),
        modelMatrix: Matrix4.fromTranslation(new Cartesian3(earthR, 0, 0)),
        asynchronous: false
      })
    );

    const solarWindColor = getSolarWindColor(spaceWeather.solarWindSpeed);
    const particleCollection = viewer.scene.primitives.add(
      new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE_AND_TRANSLUCENT })
    );

    const particleCount = 200;
    const streamSpread = earthR * 6;
    const initialWindFrame = computeSolarWindFrame(JulianDate.now(), earthR);

    const particles: SolarWindParticle[] = [];

    for (let index = 0; index < particleCount; index += 1) {
      const point = particleCollection.add({
        position: new Cartesian3(),
        pixelSize: randomInRange(1.5, 3.5),
        color: solarWindColor.withAlpha(randomInRange(0.35, 0.8)),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      });

      const particle: SolarWindParticle = {
        primitive: point,
        x: 0,
        y: 0,
        z: 0,
        speedScale: randomInRange(0.8, 1.25)
      };

      setParticleOnSolarWindStream(
        particle,
        initialWindFrame,
        streamSpread,
        0
      );
      particle.primitive.position = new Cartesian3(particle.x, particle.y, particle.z);
      particles.push(particle);
    }

    let lastFrameMs = performance.now();
    const startTimeMs = performance.now();

    const onPreRender = (_scene: unknown, time: JulianDate): void => {
      const nowMs = performance.now();
      const deltaSeconds = Math.min((nowMs - lastFrameMs) / 1000, 0.12);
      lastFrameMs = nowMs;

      const timeSeconds = JulianDate.toDate(time).getTime() / 1000;
      const elapsedSeconds = (nowMs - startTimeMs) / 1000;

      // --- Animate satellites along their orbits ---
      satAnimStates.forEach((state) => {
        const angularVelocity = CesiumMath.TWO_PI / state.period;
        const theta = state.initialTheta + angularVelocity * elapsedSeconds;
        state.point.position = orbitPoint(theta, state.radius, state.inclination, state.ascendingNode);
      });

      if (selectedSatelliteNoradId !== null) {
        const selectedSatState = satAnimByNorad.get(selectedSatelliteNoradId);
        if (selectedSatState) {
          selectedSatelliteRing.show = true;
          Cartesian3.clone(selectedSatState.point.position, selectedRingPosition);
        } else {
          selectedSatelliteRing.show = false;
        }
      } else {
        selectedSatelliteRing.show = false;
      }

      // --- Update conjunction lines: only show when satellites are near each other ---
      const conjunctionProximityThreshold = earthR * 3; // ~19,000km
      conjunctionLineState.forEach((lineState) => {
        const s1 = satAnimByNorad.get(lineState.sat1NoradId);
        const s2 = satAnimByNorad.get(lineState.sat2NoradId);
        if (!s1 || !s2) return;

        const dist = Cartesian3.distance(s1.point.position, s2.point.position);
        const isSelectedConjunction = selectedConjunctionId === lineState.conjunction.id;
        if (dist > conjunctionProximityThreshold && !isSelectedConjunction) {
          // Too far apart — hide the line
          lineState.polyline.show = false;
          return;
        }

        lineState.polyline.show = true;
        lineState.polyline.width = isSelectedConjunction ? 3 : 2;
        lineState.polyline.positions = createArcPositions(s1.point.position, s2.point.position);

        const hoursToTca = (lineState.conjunction.tca.getTime() - Date.now()) / 3_600_000;
        const urgency = clamp((6 - hoursToTca) / 6, 0, 1);
        const threadPulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(timeSeconds * Math.PI));
        const color = Color.lerp(ORANGE_COLOR, RED_COLOR, urgency, new Color());
        color.alpha = isSelectedConjunction ? 1.0 : threadPulse;

        const uniforms = lineState.polyline.material.uniforms as { color: Color };
        uniforms.color = color;
      });

      const criticalPulse = 0.5 + 0.5 * Math.sin(timeSeconds * 4.5);
      criticalPoints.forEach((point) => {
        point.pixelSize = 10 + criticalPulse * 2;
        point.color = RED_COLOR.withAlpha(0.7 + criticalPulse * 0.3);
      });

      const flowSpeed = spaceWeather.solarWindSpeed * 18_000;
      const windFrame = computeSolarWindFrame(time, earthR);
      const streamEndProjection =
        windFrame.streamEnd.x * windFrame.sunDir.x +
        windFrame.streamEnd.y * windFrame.sunDir.y +
        windFrame.streamEnd.z * windFrame.sunDir.z;
      const shieldRadiusYZ = earthR * 10; // magnetosphere Y/Z radius
      const shieldRadiusX = earthR * 9;   // magnetosphere X radius
      const shieldCenterX = earthR;       // magnetosphere is offset +X

      particles.forEach((particle, index) => {
        const travelStep = flowSpeed * particle.speedScale * deltaSeconds;
        particle.x += windFrame.flowDir.x * travelStep;
        particle.y += windFrame.flowDir.y * travelStep;
        particle.z += windFrame.flowDir.z * travelStep;

        particle.y += Math.sin((timeSeconds + index) * 0.7) * 200 * deltaSeconds;
        particle.z += Math.cos((timeSeconds + index) * 0.5) * 200 * deltaSeconds;

        // Check if particle is inside the magnetosphere ellipsoid
        const dx = particle.x - shieldCenterX;
        const ellipsoidDist =
          (dx * dx) / (shieldRadiusX * shieldRadiusX) +
          (particle.y * particle.y) / (shieldRadiusYZ * shieldRadiusYZ) +
          (particle.z * particle.z) / (shieldRadiusYZ * shieldRadiusYZ);

        if (ellipsoidDist < 1.0) {
          // Deflect outward in Y/Z — push away from the central axis
          const lateralDist = Math.sqrt(particle.y * particle.y + particle.z * particle.z);
          if (lateralDist < 1) {
            // Particle is right on the axis, give it a random push direction
            const angle = randomInRange(0, CesiumMath.TWO_PI);
            particle.y += Math.cos(angle) * earthR * 0.5;
            particle.z += Math.sin(angle) * earthR * 0.5;
          } else {
            // Push outward along the Y/Z direction (away from the nose)
            const deflectStrength = flowSpeed * particle.speedScale * deltaSeconds * 2.5;
            particle.y += (particle.y / lateralDist) * deflectStrength;
            particle.z += (particle.z / lateralDist) * deflectStrength;
          }

          // Also slow down forward (X) motion near the magnetosphere nose
          particle.x += flowSpeed * particle.speedScale * deltaSeconds * 0.4;
        }

        const axisProjection =
          particle.x * windFrame.sunDir.x +
          particle.y * windFrame.sunDir.y +
          particle.z * windFrame.sunDir.z;
        if (axisProjection < streamEndProjection) {
          setParticleOnSolarWindStream(particle, windFrame, streamSpread, 0);
        }

        particle.primitive.position = new Cartesian3(
          particle.x,
          particle.y,
          particle.z
        );
      });
    };

    viewer.scene.preRender.addEventListener(onPreRender);

    let mouseDownPosition = { x: 0, y: 0 };

    viewer.screenSpaceEventHandler.setInputAction(
      (event: { position: Cartesian2 }) => {
        mouseDownPosition = {
          x: event.position.x,
          y: event.position.y
        };
      },
      ScreenSpaceEventType.LEFT_DOWN
    );

    viewer.screenSpaceEventHandler.setInputAction(
      (event: { position: Cartesian2 }) => {
        const dx = event.position.x - mouseDownPosition.x;
        const dy = event.position.y - mouseDownPosition.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) return;

        const picked = viewer.scene.pick(event.position);
        if (!defined(picked)) return;

        const pickedWithId = picked as { id?: unknown };
        if (!isSatellitePickPayload(pickedWithId.id)) return;

        setSelectedSatellite(pickedWithId.id.satellite);
      },
      ScreenSpaceEventType.LEFT_UP
    );

    return () => {
      isDisposed = true;

      viewer.scene.preRender.removeEventListener(onPreRender);
      viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOWN);
      viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_UP);
      unsubscribeStore();

      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, [conjunctions, satellites, setSelectedSatellite, spaceWeather]);

  return <div ref={containerRef} className="h-full w-full" />;
};
