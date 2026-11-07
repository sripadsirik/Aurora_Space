import { afterEach, expect, it } from "vitest";
import { useAerospace } from "./store";
import { useSceneStore } from "../store/sceneStore";
afterEach(() => {
  useAerospace.setState(useAerospace.getInitialState(), true);
  useSceneStore.setState(useSceneStore.getInitialState(), true);
});
it("watches one launch mission at a time without scheduling a simulated ascent", () => {
  useAerospace
    .getState()
    .set({ followedLaunchId: "first", launchCameraFollow: true });
  useAerospace.getState().set({ followedLaunchId: "second" });
  expect(useAerospace.getState().followedLaunchId).toBe("second");
  expect(useAerospace.getState().simulation).toBeNull();
});
it("keeps satellite follow engaged for zoom commands and releases it for home", () => {
  useSceneStore.getState().setFollowing(true);
  useSceneStore.getState().requestCamera("zoom-out");
  expect(useSceneStore.getState().following).toBe(true);
  useSceneStore.getState().requestCamera("zoom-in");
  expect(useSceneStore.getState().following).toBe(true);
  useSceneStore.getState().requestCamera("home");
  expect(useSceneStore.getState().following).toBe(false);
});
it("can isolate a layer without turning off the source catalog", () => {
  useSceneStore.getState().setSatellitesOn(false);
  useAerospace.getState().set({ aircraftOn: false, launchesOn: true });
  expect(useSceneStore.getState().satellitesOn).toBe(false);
  expect(useAerospace.getState().launchesOn).toBe(true);
});
it("locate detaches aircraft and launch cameras before starting a map flight", () => {
  useAerospace.getState().set({
    aircraftFollow: true,
    launchCameraFollow: true,
    followedLaunchId: "mission",
  });
  useAerospace.getState().focus("air:test");
  expect(useAerospace.getState().aircraftFollow).toBe(false);
  expect(useAerospace.getState().launchCameraFollow).toBe(false);
  expect(useAerospace.getState().followedLaunchId).toBe("mission");
});
