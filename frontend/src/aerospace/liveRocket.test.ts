import { afterEach, expect, it, vi } from "vitest";
import { Cartesian3, CustomDataSource } from "cesium";
vi.mock("../utils/env", () => ({
  env: { VITE_WS_URL: "ws://127.0.0.1:8080/ws", VITE_CESIUM_ION_TOKEN: "" },
}));
import { installLiveRocket } from "./liveRocket";
import { useAerospace } from "./store";
import { useAuroraStore } from "../store/auroraStore";
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  useAerospace.setState(useAerospace.getInitialState(), true);
});
it("feeds actual mission-matched observations into a 3D model and follows descent samples", async () => {
  vi.useFakeTimers();
  const now = Date.parse("2026-11-05T16:01:00Z");
  vi.setSystemTime(now);
  useAuroraStore.setState({ currentMode: "OPS" });
  let altitude = 5000;
  const fetcher = vi.fn(
    async (_input: RequestInfo | URL) =>
      new Response(
        JSON.stringify({
          fetchedAt: new Date().toISOString(),
          stale: false,
          data: {
            missionId: "test",
            positionType: "observed",
            source: "Position test feed",
            positions: [
              {
                vehicleId: "stage-1",
                observedAt: new Date().toISOString(),
                latitude: 28,
                longitude: -80,
                altitudeM: altitude,
                phase: altitude === 5000 ? "ascent" : "descent",
              },
            ],
          },
        }),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  let source: CustomDataSource | undefined;
  const viewer = {
    isDestroyed: () => false,
    dataSources: {
      add: (s: CustomDataSource) => {
        source = s;
        return Promise.resolve(s);
      },
      remove: vi.fn(),
    },
    scene: {
      preRender: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    },
  };
  const live = installLiveRocket(viewer as any);
  dispose = live.dispose;
  useAerospace.getState().set({ followedLaunchId: "test" });
  await vi.waitFor(() =>
    expect(useAerospace.getState().rocketTelemetry.status).toBe("live"),
  );
  expect(source!.entities.getById("rocket:stage-1")?.model).toBeDefined();
  const first = live.target()!;
  expect(
    Cartesian3.distance(first, Cartesian3.fromDegrees(-80, 28, 5000)),
  ).toBeLessThan(0.01);
  altitude = 1000;
  await vi.advanceTimersByTimeAsync(2000);
  expect(useAerospace.getState().rocketTelemetry.positions[0].phase).toBe(
    "descent",
  );
  const descending = live.target()!;
  expect(Cartesian3.magnitude(descending)).toBeLessThan(
    Cartesian3.magnitude(first),
  );
  expect(fetcher.mock.calls[0][0]).toBeInstanceOf(URL);
});
it("never creates or moves a live rocket when the source is unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "No provider configured" }), {
          status: 503,
        }),
    ),
  );
  const viewer = {
    isDestroyed: () => false,
    dataSources: { add: async (s: CustomDataSource) => s, remove: vi.fn() },
    scene: {
      preRender: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    },
  };
  const live = installLiveRocket(viewer as any);
  dispose = live.dispose;
  useAerospace.getState().set({ followedLaunchId: "test" });
  await vi.waitFor(() =>
    expect(useAerospace.getState().rocketTelemetry.status).toBe("unavailable"),
  );
  expect(live.target()).toBeUndefined();
  expect(useAerospace.getState().rocketTelemetry.positions).toHaveLength(0);
});
