import {
  CallbackPositionProperty,
  CallbackProperty,
  Cartesian3,
  Color,
  CustomDataSource,
  HeadingPitchRoll,
  Matrix3,
  Matrix4,
  PolylineGlowMaterialProperty,
  Quaternion,
  Transforms,
  type Viewer,
} from "cesium";
import { useAerospace } from "./store";
import { useAuroraStore } from "../store/auroraStore";
import {
  parseRocketTelemetry,
  rocketPositionAt,
  type RocketPosition,
} from "./rocketTelemetry";
import { env } from "../utils/env";
export function installLiveRocket(viewer: Viewer) {
  const source = new CustomDataSource("observed-rocket-positions");
  let disposed = false,
    active = "",
    controller: AbortController | null = null,
    timer: ReturnType<typeof setTimeout> | undefined;
  const tracks = new Map<string, RocketPosition[]>();
  void viewer.dataSources.add(source).then(() => {
    if (disposed && !viewer.isDestroyed())
      viewer.dataSources.remove(source, true);
  });
  const reset = () => {
    controller?.abort();
    clearTimeout(timer);
    tracks.clear();
    source.entities.removeAll();
  };
  const sync = () => {
    const state = useAerospace.getState(),
      id = state.followedLaunchId ?? "";
    if (active === id) return;
    reset();
    active = id;
    state.set({
      rocketTelemetry: {
        missionId: id || null,
        source: "",
        positions: [],
        status: id ? "connecting" : "idle",
        error: "",
      },
      telemetryVehicle: null,
    });
    if (!id || !env.VITE_WS_URL) return;
    const abort = new AbortController();
    controller = abort;
    const url = new URL(env.VITE_WS_URL);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = "/api/aerospace/telemetry/" + encodeURIComponent(id);
    url.search = "";
    const poll = async () => {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(6000)]),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok)
          throw Error(
            typeof body?.error === "string"
              ? body.error
              : response.status === 404
                ? "Rocket position endpoint unavailable; the gateway needs updating."
                : `Rocket provider unavailable (HTTP ${response.status})`,
          );
        const data = parseRocketTelemetry(body.data, id, Date.now());
        if (disposed || abort.signal.aborted) return;
        for (const p of data.positions) {
          const track = tracks.get(p.vehicleId) ?? [];
          if (
            !track.length ||
            p.observedAt > track[track.length - 1].observedAt
          )
            track.push(p);
          while (
            track.length > 900 ||
            (track.length && Date.now() - track[0].observedAt > 900000)
          )
            track.shift();
          tracks.set(p.vehicleId, track);
          if (!source.entities.getById("rocket:" + p.vehicleId))
            source.entities.add({
              id: "rocket:" + p.vehicleId,
              name: p.vehicleId,
              position: new CallbackPositionProperty(
                (_time, result) => rocketPositionAt(track, Date.now(), result),
                false,
              ),
              orientation: new CallbackProperty(() => {
                const last = track.at(-1)!;
                const pos = rocketPositionAt(track, Date.now())!;
                const enu = Transforms.eastNorthUpToFixedFrame(pos),
                  local = Matrix3.multiply(
                    Matrix3.fromRotationZ((-last.heading * Math.PI) / 180),
                    Matrix3.fromRotationY((last.tilt * Math.PI) / 180),
                    new Matrix3(),
                  );
                return Quaternion.fromRotationMatrix(
                  Matrix3.multiply(
                    Matrix4.getMatrix3(enu, new Matrix3()),
                    local,
                    new Matrix3(),
                  ),
                );
              }, false),
              model: {
                uri: import.meta.env.BASE_URL + "models/launch-vehicle.glb",
                minimumPixelSize: 52,
              },
              polyline: {
                positions: new CallbackProperty(
                  () =>
                    track.map((s) =>
                      Cartesian3.fromDegrees(s.lon, s.lat, s.altitudeM),
                    ),
                  false,
                ),
                width: 2,
                material: new PolylineGlowMaterialProperty({
                  color: Color.CYAN,
                }),
              },
            });
        }
        const positions = [...tracks.values()].map((t) => t[t.length - 1]);
        const fresh = positions.some((p) => Date.now() - p.observedAt <= 15000);
        const current = useAerospace.getState();
        current.set({
          rocketTelemetry: {
            missionId: id,
            source: data.source,
            positions,
            status: !positions.length
              ? "waiting"
              : fresh && !body.stale
                ? "live"
                : "stale",
            error: body.stale ? "Provider returned cached telemetry" : "",
          },
          telemetryVehicle:
            current.telemetryVehicle ?? positions[0]?.vehicleId ?? null,
        });
      } catch (error) {
        if (!disposed && !abort.signal.aborted) {
          const current = useAerospace.getState();
          current.set({
            rocketTelemetry: {
              ...current.rocketTelemetry,
              missionId: id,
              status: tracks.size ? "stale" : "unavailable",
              error:
                error instanceof Error
                  ? error.message
                  : "Rocket provider unavailable",
            },
          });
        }
      } finally {
        if (!disposed && !abort.signal.aborted)
          timer = setTimeout(poll, tracks.size ? 1000 : 10000);
      }
    };
    void poll();
  };
  const tick = () => {
    const state = useAerospace.getState();
    if (
      state.rocketTelemetry.status === "live" &&
      !state.rocketTelemetry.positions.some(
        (p) => Date.now() - p.observedAt <= 15000,
      )
    )
      state.set({
        rocketTelemetry: {
          ...state.rocketTelemetry,
          status: "stale",
          error: "No recent rocket position samples",
        },
      });
    source.show =
      state.launchesOn &&
      !state.simulation &&
      useAuroraStore.getState().currentMode !== "HELIO";
    for (const [id, track] of tracks) {
      const e = source.entities.getById("rocket:" + id);
      if (e) e.show = Date.now() - track[track.length - 1].observedAt <= 90000;
    }
  };
  const unsubscribe = useAerospace.subscribe((s, old) => {
    if (s.followedLaunchId !== old.followedLaunchId) sync();
  });
  sync();
  viewer.scene.preRender.addEventListener(tick);
  return {
    target: () => {
      const state = useAerospace.getState();
      if (
        state.rocketTelemetry.status !== "live" ||
        state.rocketTelemetry.missionId !== state.followedLaunchId ||
        !state.telemetryVehicle
      )
        return;
      const track = tracks.get(state.telemetryVehicle);
      return track && Date.now() - track[track.length - 1].observedAt <= 15000
        ? rocketPositionAt(track, Date.now())
        : undefined;
    },
    dispose: () => {
      disposed = true;
      reset();
      unsubscribe();
      viewer.scene.preRender.removeEventListener(tick);
      if (!viewer.isDestroyed()) viewer.dataSources.remove(source, true);
    },
  };
}
