import { afterEach, expect, it, vi } from "vitest";
import { Cartesian3 } from "cesium";
const camera = vi.hoisted(() => ({ update: vi.fn(), release: vi.fn() }));
vi.mock("./followCamera", () => ({ createFollowCamera: () => camera }));
import { installAerospaceTracking } from "./tracking";
import { useAerospace } from "./store";
import { useSceneStore } from "../store/sceneStore";
import { useAuroraStore } from "../store/auroraStore";
afterEach(() => {
  useAerospace.setState(useAerospace.getInitialState(), true);
  useSceneStore.setState(useSceneStore.getInitialState(), true);
  vi.clearAllMocks();
});
it("starts mission watch at the same close angle as the preview without creating simulated flight", () => {
  useAuroraStore.setState({ currentMode: "OPS", selectedSatellite: null });
  let tick: () => void = () => {};
  const viewer = {
    scene: {
      preRender: {
        addEventListener: (fn: () => void) => (tick = fn),
        removeEventListener: vi.fn(),
      },
      globe: { getHeight: () => 100 },
    },
    clock: { currentTime: undefined },
  };
  const dispose = installAerospaceTracking(
    viewer as any,
    (id) =>
      id === "launch:first" ? Cartesian3.fromDegrees(-80, 28) : undefined,
    () => null,
  );
  useAerospace
    .getState()
    .set({ followedLaunchId: "first", launchCameraFollow: true });
  tick();
  const [center, offset] = camera.update.mock.calls.at(-1)!;
  expect(
    Cartesian3.distance(center, Cartesian3.fromDegrees(-80, 28, 130)),
  ).toBeLessThan(0.001);
  expect(offset.heading).toBe(-0.8);
  expect(offset.pitch).toBe(-0.25);
  expect(offset.range).toBe(220);
  expect(useAerospace.getState().simulation).toBeNull();
  useSceneStore.getState().requestCamera("zoom-out");
  expect(useAerospace.getState().launchCameraFollow).toBe(true);
  useSceneStore.getState().requestCamera("home");
  expect(useAerospace.getState().launchCameraFollow).toBe(false);
  expect(useAerospace.getState().followedLaunchId).toBe("first");
  dispose();
});
