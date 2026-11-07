import type { RocketPosition } from "./rocketTelemetry";
import { create } from "zustand";
import type { Aircraft, Launch } from "./data";
export interface LiftoffSimulation {
  launchId: string;
  seconds: number;
  playing: boolean;
  rate: number;
  follow: boolean;
  terrainReady: boolean;
}
export interface FeedInfo {
  at: string;
  error: string;
  stale: boolean;
}
interface AerospaceState {
  rocketTelemetry: {
    missionId: string | null;
    source: string;
    positions: RocketPosition[];
    status:
      "idle" | "connecting" | "waiting" | "live" | "stale" | "unavailable";
    error: string;
  };
  telemetryVehicle: string | null;
  feedInfo: Record<"aircraft" | "launches", FeedInfo>;
  tab: "launches" | "aircraft";
  followedLaunchId: string | null;
  launchCameraFollow: boolean;
  simulation: LiftoffSimulation | null;
  aircraftFollow: boolean;
  scanId: number;
  open: boolean;
  aircraftOn: boolean;
  launchesOn: boolean;
  militaryOnly: boolean;
  region: string;
  aircraft: Aircraft[];
  launches: Launch[];
  selected: string | null;
  focusId: number;
  set: (next: Partial<Omit<AerospaceState, "set" | "focus">>) => void;
  focus: (id: string) => void;
}
export const useAerospace = create<AerospaceState>((set) => ({
  rocketTelemetry: {
    missionId: null,
    source: "",
    positions: [],
    status: "idle",
    error: "",
  },
  telemetryVehicle: null,
  feedInfo: {
    aircraft: { at: "", error: "", stale: false },
    launches: { at: "", error: "", stale: false },
  },
  tab: "launches",
  followedLaunchId: null,
  launchCameraFollow: false,
  simulation: null,
  aircraftFollow: false,
  scanId: 0,
  open: false,
  aircraftOn: true,
  launchesOn: true,
  militaryOnly: false,
  region: "worldwide",
  aircraft: [],
  launches: [],
  selected: null,
  focusId: 0,
  set: (next) => set(next),
  focus: (id) =>
    set((s) => ({
      selected: id,
      aircraftFollow: false,
      launchCameraFollow: false,
      ...(s.simulation
        ? { simulation: { ...s.simulation, follow: false } }
        : {}),
      focusId: s.focusId + 1,
      ...(id.startsWith("launch:")
        ? { launchesOn: true }
        : { aircraftOn: true }),
    })),
}));

/** Detach camera ownership before another controller starts a camera flight. */
export function detachAerospaceCamera() {
  const state = useAerospace.getState();
  if (
    state.aircraftFollow ||
    state.launchCameraFollow ||
    state.simulation?.follow
  ) {
    state.set({
      aircraftFollow: false,
      launchCameraFollow: false,
      ...(state.simulation
        ? { simulation: { ...state.simulation, follow: false } }
        : {}),
    });
  }
}
