import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SceneQuality = "performance" | "balanced" | "cinematic";
export type CameraPreset = "home" | "polar" | "terminator" | "orbit";
export type SceneCommand = CameraPreset | "zoom-in" | "zoom-out";

interface SceneState {
  quality: SceneQuality;
  lighting: boolean;
  orbitPaths: boolean;
  orbitFrame: "orbital" | "earth-fixed";
  setOrbitFrame: (frame: "orbital" | "earth-fixed") => void;
  coverage: boolean;
  spaceWeather: boolean;
  autoRotate: boolean;
  following: boolean;
  command: SceneCommand;
  commandId: number;
  setQuality: (quality: SceneQuality) => void;
  toggle: (key: "lighting" | "orbitPaths" | "coverage" | "spaceWeather" | "autoRotate") => void;
  setFollowing: (following: boolean) => void;
  requestCamera: (command: SceneCommand) => void;
}

export const useSceneStore = create<SceneState>()(persist((set) => ({
  quality: "balanced",
  lighting: true,
  orbitPaths: true,
  orbitFrame: "orbital",
  setOrbitFrame: (orbitFrame) => set({orbitFrame}),
  coverage: false,
  spaceWeather: true,
  autoRotate: false,
  following: false,
  command: "home",
  commandId: 0,
  setQuality: (quality) => set({ quality }),
  toggle: (key) => set((state) => ({ [key]: !state[key] })),
  setFollowing: (following) => set({ following }),
  requestCamera: (command) => set((state) => ({ command, commandId: state.commandId + 1, following: false }))
}), {
  name: "aurora-scene-v1",
  partialize: ({ quality, lighting, orbitPaths, coverage, spaceWeather }) => ({ quality, lighting, orbitPaths, coverage, spaceWeather })
}));
