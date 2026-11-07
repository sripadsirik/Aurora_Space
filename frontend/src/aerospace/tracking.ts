import {
  Cartesian3,
  Cartographic,
  HeadingPitchRange,
  sampleTerrainMostDetailed,
  type Viewer,
} from "cesium";
import { useAerospace } from "./store";
import { useSceneStore } from "../store/sceneStore";
import { useAuroraStore } from "../store/auroraStore";
import { createFollowCamera } from "./followCamera";
export function installAerospaceTracking(
  viewer: Viewer,
  position: (id: string) => Cartesian3 | undefined,
  simulationPosition: () => Cartesian3 | null,
  livePosition: () => Cartesian3 | undefined = () => undefined,
) {
  const camera = createFollowCamera(viewer);
  let active = "";
  let disposed = false;
  let pad: {
    id: string;
    provider: Viewer["terrainProvider"];
    height: number | null;
  } | null = null;
  const tick = () => {
    const s = useAerospace.getState();
    let id = "",
      center: Cartesian3 | undefined,
      offset = new HeadingPitchRange(-0.8, -0.25, 220);
    if (useAuroraStore.getState().currentMode !== "HELIO") {
      if (s.simulation?.follow && s.launchesOn) {
        id = "sim:" + s.simulation.launchId;
        center = simulationPosition() ?? undefined;
      } else if (s.followedLaunchId && s.launchCameraFollow && s.launchesOn) {
        id = "launch:" + s.followedLaunchId;
        const observed = livePosition();
        const ground = position(id);
        if (observed) center = observed;
        else if (ground && !s.rocketTelemetry.positions.length) {
          const c = Cartographic.fromCartesian(ground);
          const provider = viewer.terrainProvider;
          let height = viewer.scene.globe.getHeight(c) ?? c.height;
          if (provider?.availability) {
            if (pad?.id !== id || pad.provider !== provider) {
              const request = { id, provider, height: null as number | null };
              pad = request;
              void sampleTerrainMostDetailed(provider, [Cartographic.clone(c)])
                .then((points) => {
                  if (!disposed && pad === request) {
                    request.height = Number.isFinite(points[0].height)
                      ? points[0].height
                      : height;
                    viewer.scene.requestRender();
                  }
                })
                .catch(() => {
                  if (!disposed && pad === request) {
                    request.height = height;
                    viewer.scene.requestRender();
                  }
                });
            }
            if (pad.height === null) {
              camera.release();
              active = "";
              return;
            }
            height = pad.height;
          }
          center = Cartesian3.fromRadians(c.longitude, c.latitude, height + 30);
        }
      } else if (
        s.selected?.startsWith("air:") &&
        s.aircraftFollow &&
        s.aircraftOn
      ) {
        id = s.selected;
        center = position(id);
        offset = new HeadingPitchRange(-0.7, -0.35, 180);
      }
    }
    if (!center) {
      camera.release();
      active = "";
      return;
    }
    if (active !== id) {
      camera.release();
      active = id;
      useSceneStore.setState({ following: false, autoRotate: false });
    }
    camera.update(center, offset);
  };
  // One owner updates the camera, after the simulation and scene positions.
  viewer.scene.preRender.addEventListener(tick);
  const commands = useSceneStore.subscribe((s, old) => {
    if (
      s.commandId !== old.commandId &&
      s.command !== "zoom-in" &&
      s.command !== "zoom-out"
    ) {
      const air = useAerospace.getState();
      air.set({
        aircraftFollow: false,
        launchCameraFollow: false,
        ...(air.simulation
          ? { simulation: { ...air.simulation, follow: false } }
          : {}),
      });
      camera.release();
      active = "";
    }
  });
  const ownership = useAerospace.subscribe((s, old) => {
    if (
      s.aircraftFollow !== old.aircraftFollow ||
      s.launchCameraFollow !== old.launchCameraFollow ||
      s.followedLaunchId !== old.followedLaunchId ||
      s.simulation?.follow !== old.simulation?.follow
    )
      tick();
  });
  const satellites = useAuroraStore.subscribe((s, old) => {
    if (s.selectedSatellite && s.selectedSatellite !== old.selectedSatellite) {
      const air = useAerospace.getState();
      air.set({
        aircraftFollow: false,
        launchCameraFollow: false,
        simulation: null,
      });
      camera.release();
      active = "";
    }
  });
  return () => {
    disposed = true;
    commands();
    ownership();
    satellites();
    camera.release();
    viewer.scene.preRender.removeEventListener(tick);
  };
}
