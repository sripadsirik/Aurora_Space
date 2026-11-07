import { create } from "zustand";
import type { TrafficCamera } from "./data";
interface EarthState {
  mapStyle: "imagery" | "streets";
  feed: { at: string; error: boolean };
  camerasOn: boolean;
  cameraNetwork: string;
  cameraArea: string;
  cameras: TrafficCamera[];
  selected: string | null;
  destination: { lat: number; lon: number; name: string } | null;
  destinationId: number;
  set: (next: Partial<Omit<EarthState, "set" | "locate">>) => void;
  locate: (lat: number, lon: number, name: string) => void;
}
export const useEarth = create<EarthState>((set) => ({
  mapStyle: "imagery",
  feed: { at: "", error: false },
  camerasOn: true,
  cameraNetwork: "all",
  cameraArea: "",
  cameras: [],
  selected: null,
  destination: null,
  destinationId: 0,
  set: (next) => set(next),
  locate: (lat, lon, name) =>
    set((s) => ({
      destination: { lat, lon, name },
      destinationId: s.destinationId + 1,
    })),
}));
