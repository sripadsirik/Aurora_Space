import { create } from "zustand";

import { mockConjunctions } from "../data/mock/conjunctions";
import { mockSatellites } from "../data/mock/satellites";
import { mockSpaceWeather } from "../data/mock/spaceWeather";
import type { Conjunction, Satellite, SpaceWeather } from "../types/space";

export type PanelType =
  | "satellite-detail"
  | "conjunction-detail"
  | "space-weather"
  | "data-layers";

interface AuroraStoreState {
  selectedSatellite: Satellite | null;
  selectedConjunction: Conjunction | null;
  activePanels: Set<PanelType>;
  spaceWeather: SpaceWeather;
  satellites: Satellite[];
  conjunctions: Conjunction[];
  isConnectedToBackend: boolean;
  setSelectedSatellite: (satellite: Satellite | null) => void;
  setSelectedConjunction: (conjunction: Conjunction | null) => void;
  openPanel: (panel: PanelType) => void;
  closePanel: (panel: PanelType) => void;
}

const openPanelInSet = (panels: Set<PanelType>, panel: PanelType): Set<PanelType> => {
  const next = new Set(panels);
  next.add(panel);
  return next;
};

const closePanelInSet = (panels: Set<PanelType>, panel: PanelType): Set<PanelType> => {
  const next = new Set(panels);
  next.delete(panel);
  return next;
};

export const useAuroraStore = create<AuroraStoreState>((set) => ({
  selectedSatellite: null,
  selectedConjunction: null,
  activePanels: new Set<PanelType>(),
  spaceWeather: mockSpaceWeather,
  satellites: mockSatellites,
  conjunctions: mockConjunctions,
  isConnectedToBackend: false,
  setSelectedSatellite: (satellite) =>
    set((state) => ({
      selectedSatellite: satellite,
      activePanels: satellite
        ? openPanelInSet(state.activePanels, "satellite-detail")
        : closePanelInSet(state.activePanels, "satellite-detail")
    })),
  setSelectedConjunction: (conjunction) =>
    set((state) => ({
      selectedConjunction: conjunction,
      activePanels: conjunction
        ? openPanelInSet(state.activePanels, "conjunction-detail")
        : closePanelInSet(state.activePanels, "conjunction-detail")
    })),
  openPanel: (panel) =>
    set((state) => ({
      activePanels: openPanelInSet(state.activePanels, panel)
    })),
  closePanel: (panel) =>
    set((state) => {
      const nextState: Partial<AuroraStoreState> = {
        activePanels: closePanelInSet(state.activePanels, panel)
      };

      if (panel === "satellite-detail") {
        nextState.selectedSatellite = null;
      }

      if (panel === "conjunction-detail") {
        nextState.selectedConjunction = null;
      }

      return nextState;
    })
}));
