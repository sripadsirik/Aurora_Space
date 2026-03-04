import {
  BlendOption,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  ColorMaterialProperty,
  createGooglePhotorealistic3DTileset,
  defined,
  EllipsoidGeometry,
  GeometryInstance,
  Ion,
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
  Viewer
} from "cesium";
import { useEffect, useRef } from "react";

import type { ConjunctionWarning, Satellite, SpaceWeather } from "../types/space";
import { getSolarWindColor, riskColorMap } from "../utils/colors";
import { env } from "../utils/env";
import { createOrbitPositions, earthRadiusMeters, kpToAuroraRadiusDegrees } from "../utils/orbit";

interface GlobeViewProps {
  satellites: Satellite[];
  conjunctions: ConjunctionWarning[];
  spaceWeather: SpaceWeather;
}

interface SatellitePickPayload {
  type: "satellite";
  satellite: Satellite;
}

interface ConjunctionLineState {
  conjunction: ConjunctionWarning;
  polyline: {
    material: Material;
  };
}

interface SolarWindParticle {
  primitive: PointPrimitive;
  x: number;
  y: number;
  z: number;
  speedScale: number;
}

interface GeometryAttributes {
  color?: Uint8Array;
}

const AURORA_COLOR = Color.fromCssColorString("#00ff96");
const ORANGE_COLOR = Color.fromCssColorString("#ff6600");
const RED_COLOR = Color.fromCssColorString("#ff0000");

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const randomInRange = (min: number, max: number): number => min + Math.random() * (max - min);

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

    const cameraController = viewer.scene.screenSpaceCameraController;
    cameraController.inertiaSpin = 0.95;
    cameraController.inertiaTranslate = 0.95;
    cameraController.inertiaZoom = 0.92;

    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(-75, 20, 20_000_000),
      orientation: {
        heading: CesiumMath.toRadians(22),
        pitch: CesiumMath.toRadians(-30),
        roll: 0
      }
    });

    let isDisposed = false;

    createGooglePhotorealistic3DTileset()
      .then((googleTileset) => {
        if (isDisposed || viewer.isDestroyed()) {
          googleTileset.destroy();
          return;
        }

        viewer.scene.primitives.add(googleTileset);
      })
      .catch((error: unknown) => {
        // This keeps the globe functional even when token/config is missing.
        console.error("[AURORA] Failed to load Google Photorealistic 3D Tiles", error);
      });

    const satelliteMap = new Map<number, Satellite>();
    satellites.forEach((satellite) => {
      satelliteMap.set(satellite.noradId, satellite);
    });

    const satellitePoints = viewer.scene.primitives.add(
      new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE_AND_TRANSLUCENT })
    );

    const criticalPoints: PointPrimitive[] = [];

    satellites.forEach((satellite) => {
      const point = satellitePoints.add({
        position: Cartesian3.fromDegrees(satellite.lon, satellite.lat, satellite.altitudeKm * 1000),
        pixelSize: satellite.riskLevel === "critical" ? 10 : 6,
        color: riskColorMap[satellite.riskLevel].clone(),
        outlineColor: Color.WHITE.withAlpha(0.25),
        outlineWidth: satellite.riskLevel === "critical" ? 2 : 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        id: {
          type: "satellite",
          satellite
        }
      });

      if (satellite.riskLevel === "critical") {
        criticalPoints.push(point);
      }
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
        asynchronous: true
      })
    );

    const conjunctionLines = viewer.scene.primitives.add(new PolylineCollection());

    const conjunctionLineState: ConjunctionLineState[] = [];

    conjunctions.forEach((conjunction) => {
      const first = satelliteMap.get(conjunction.object1.noradId);
      const second = satelliteMap.get(conjunction.object2.noradId);

      if (!first || !second) {
        return;
      }

      const polyline = conjunctionLines.add({
        positions: [
          Cartesian3.fromDegrees(first.lon, first.lat, first.altitudeKm * 1000),
          Cartesian3.fromDegrees(second.lon, second.lat, second.altitudeKm * 1000)
        ],
        width: 2,
        material: Material.fromType("Color", {
          color: ORANGE_COLOR.withAlpha(0.8)
        })
      });

      conjunctionLineState.push({
        conjunction,
        polyline: {
          material: polyline.material
        }
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

    const magnetosphereId = "magnetosphere-shell";
    const earthR = earthRadiusMeters;

    const magnetospherePrimitive = viewer.scene.primitives.add(
      new Primitive({
        geometryInstances: new GeometryInstance({
          id: magnetosphereId,
          geometry: new EllipsoidGeometry({
            radii: new Cartesian3(earthR * 9, earthR * 10, earthR * 10),
            vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
            stackPartitions: 64,
            slicePartitions: 64
          }),
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(new Color(100 / 255, 180 / 255, 1, 0.04))
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

    let magnetosphereAttributes: GeometryAttributes | undefined;

    const solarWindColor = getSolarWindColor(spaceWeather.solarWindSpeed);
    const particleCollection = viewer.scene.primitives.add(
      new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE_AND_TRANSLUCENT })
    );

    const particleCount = 200;
    const streamStartX = -earthR * 25;
    const streamEndX = earthR * 3;
    const streamSpread = earthR * 6;

    const particles: SolarWindParticle[] = [];

    for (let index = 0; index < particleCount; index += 1) {
      const x = randomInRange(streamStartX, -earthR * 9);
      const y = randomInRange(-streamSpread, streamSpread);
      const z = randomInRange(-streamSpread, streamSpread);
      const point = particleCollection.add({
        position: new Cartesian3(x, y, z),
        pixelSize: randomInRange(1.5, 3.5),
        color: solarWindColor.withAlpha(randomInRange(0.35, 0.8)),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      });

      particles.push({
        primitive: point,
        x,
        y,
        z,
        speedScale: randomInRange(0.8, 1.25)
      });
    }

    let lastFrameMs = performance.now();

    const onPreRender = (_scene: unknown, time: JulianDate): void => {
      const nowMs = performance.now();
      const deltaSeconds = Math.min((nowMs - lastFrameMs) / 1000, 0.12);
      lastFrameMs = nowMs;

      const timeSeconds = JulianDate.toDate(time).getTime() / 1000;

      const criticalPulse = 0.5 + 0.5 * Math.sin(timeSeconds * 4.5);
      criticalPoints.forEach((point) => {
        point.pixelSize = 10 + criticalPulse * 2;
        point.color = RED_COLOR.withAlpha(0.7 + criticalPulse * 0.3);
      });

      const threadPulseAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(timeSeconds * Math.PI));
      conjunctionLineState.forEach((lineState) => {
        const hoursToTca = (lineState.conjunction.tca.getTime() - Date.now()) / 3_600_000;
        const urgency = clamp((6 - hoursToTca) / 6, 0, 1);
        const color = Color.lerp(ORANGE_COLOR, RED_COLOR, urgency, new Color());
        color.alpha = threadPulseAlpha;

        const uniforms = lineState.polyline.material.uniforms as { color: Color };
        uniforms.color = color;
      });

      if (!magnetosphereAttributes && magnetospherePrimitive.ready) {
        magnetosphereAttributes = magnetospherePrimitive.getGeometryInstanceAttributes(
          magnetosphereId
        ) as GeometryAttributes;
      }

      if (magnetosphereAttributes?.color) {
        const alpha = 0.02 + 0.04 * (0.5 + 0.5 * Math.sin(timeSeconds * (Math.PI / 2)));
        magnetosphereAttributes.color = ColorGeometryInstanceAttribute.toValue(
          new Color(100 / 255, 180 / 255, 1, alpha)
        );
      }

      const flowSpeed = spaceWeather.solarWindSpeed * 18_000;
      particles.forEach((particle, index) => {
        particle.x += flowSpeed * particle.speedScale * deltaSeconds;
        particle.y += Math.sin((timeSeconds + index) * 0.7) * 1_500 * deltaSeconds;
        particle.z += Math.cos((timeSeconds + index) * 0.5) * 1_500 * deltaSeconds;

        if (particle.x > streamEndX) {
          particle.x = streamStartX - randomInRange(0, earthR * 3);
          particle.y = randomInRange(-streamSpread, streamSpread);
          particle.z = randomInRange(-streamSpread, streamSpread);
        }

        particle.primitive.position = new Cartesian3(particle.x, particle.y, particle.z);
      });
    };

    viewer.scene.preRender.addEventListener(onPreRender);

    viewer.screenSpaceEventHandler.setInputAction(
      (movement: { position: Cartesian2 }) => {
        const pickedObject = viewer.scene.pick(movement.position);

        if (!defined(pickedObject)) {
          return;
        }

        const pickedWithId = pickedObject as { id?: unknown };
        if (!isSatellitePickPayload(pickedWithId.id)) {
          return;
        }

        console.log("[AURORA] Satellite selected", pickedWithId.id.satellite);
      },
      ScreenSpaceEventType.LEFT_CLICK
    );

    return () => {
      isDisposed = true;

      viewer.scene.preRender.removeEventListener(onPreRender);
      viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);

      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, [conjunctions, satellites, spaceWeather]);

  return <div ref={containerRef} className="h-full w-full" />;
};
