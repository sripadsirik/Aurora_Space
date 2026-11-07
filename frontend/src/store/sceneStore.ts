import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SceneQuality = "performance" | "balanced" | "cinematic";
export type CameraPreset = "home" | "polar" | "terminator" | "orbit" | "catalog";
export type SceneCommand = CameraPreset | "zoom-in" | "zoom-out";
export interface CatalogStats {
  total: number; eligible: number; plotted: number; withheld: number; limited: number; computeMs: number;
  state: "loading" | "ready" | "late" | "error" | "demo";
}

interface SceneState {
  satellitesOn: boolean;
  setSatellitesOn: (visible: boolean) => void;
  quality: SceneQuality;
  catalogDensity: "all" | "reduced";
  setCatalogDensity: (density: "all" | "reduced") => void;
  catalogStats: CatalogStats | null;
  setCatalogStats: (stats: CatalogStats) => void;
  lighting: boolean;
  orbitPaths: boolean;
  conjunctionPaths: boolean;
  conjunctionFocus: boolean;
  setConjunctionFocus: (focus: boolean) => void;
  opsPanel: "catalog" | "pairs";
  setOpsPanel: (panel: "catalog" | "pairs") => void;
  conjunctionPathCount: { available: number; total: number } | null;
  setConjunctionPathCount: (available: number, total: number) => void;
  orbitFrame: "orbital" | "earth-fixed";
  setOrbitFrame: (frame: "orbital" | "earth-fixed") => void;
  coverage: boolean;
  spaceWeather: boolean;
  autoRotate: boolean;
  following: boolean;
  command: SceneCommand;
  commandId: number;
  setQuality: (quality: SceneQuality) => void;
  toggle: (key: "lighting" | "orbitPaths" | "conjunctionPaths" | "coverage" | "spaceWeather" | "autoRotate") => void;
  setFollowing: (following: boolean) => void;
  requestCamera: (command: SceneCommand) => void;
}

export const useSceneStore = create<SceneState>()(persist((set) => ({
  satellitesOn: true,
  setSatellitesOn: satellitesOn => set({satellitesOn, ...(!satellitesOn ? {following:false}: {})}),
  quality: "balanced",
  catalogDensity: "reduced",
  setCatalogDensity: catalogDensity => set({ catalogDensity }),
  catalogStats: null,
  setCatalogStats: catalogStats => set({ catalogStats }),
  lighting: true,
  orbitPaths: true,
  conjunctionPaths: false,
  conjunctionFocus: false,
  setConjunctionFocus: conjunctionFocus => set({ conjunctionFocus }),
  opsPanel: "catalog",
  setOpsPanel: opsPanel => set({ opsPanel }),
  conjunctionPathCount: null,
  setConjunctionPathCount: (available, total) => set(state => state.conjunctionPathCount?.available === available && state.conjunctionPathCount.total === total ? state : { conjunctionPathCount: { available, total } }),
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
  requestCamera: (command) => set((state) => ({ command, commandId: state.commandId + 1, following: command === "zoom-in" || command === "zoom-out" ? state.following : false }))
}), {
  name: "aurora-scene-v1",
  version: 3,
  migrate: (saved) => ({...(saved as object), conjunctionPaths:false,catalogDensity:"reduced"}),
  partialize: ({ satellitesOn, quality, catalogDensity, lighting, orbitPaths, conjunctionPaths, coverage, spaceWeather }) => ({ satellitesOn, quality, catalogDensity, lighting, orbitPaths, conjunctionPaths, coverage, spaceWeather })
}));
