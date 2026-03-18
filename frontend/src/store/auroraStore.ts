import { create } from "zustand";

import { mockConjunctions } from "../data/mock/conjunctions";
import { mockSatellites } from "../data/mock/satellites";
import { mockSpaceWeather } from "../data/mock/spaceWeather";
import type { Conjunction, HistoricalEvent, Satellite, SourceDiagnostic, SpaceWeather, VisualMode } from "../types/space";

export type FeedKey = "satellites" | "conjunctions" | "spaceWeather";

export type PanelType =
  | "satellite-detail"
  | "conjunction-detail"
  | "space-weather"
  | "data-layers"
  | "active-conjunctions"
  | "storm-impact"
  | "intel-analysis"
  | "cme-library";

interface AuroraStoreState {
  selectedSatellite: Satellite | null;
  selectedConjunction: Conjunction | null;
  activePanels: Set<PanelType>;
  spaceWeather: SpaceWeather;
  satellites: Satellite[];
  conjunctions: Conjunction[];
  isConnectedToBackend: boolean;
  feedLastUpdated: Record<FeedKey, Date | null>;
  sourceDiagnostics: SourceDiagnostic[];

  currentMode: VisualMode;
  earthOnlyMode: boolean;
  timelineActive: boolean;
  timelinePosition: Date;
  timelineEvent: HistoricalEvent | null;
  helioSimulationSeconds: number;
  helioPlaybackRate: number;
  helioSelectedPlaybackRate: number;
  helioBurstIntensity: number;
  helioScenarioVersion: number;
  stormAutoTriggered: boolean;
  helioSelectedCME: number | null;

  setSelectedSatellite: (satellite: Satellite | null) => void;
  setSelectedConjunction: (conjunction: Conjunction | null) => void;
  openPanel: (panel: PanelType) => void;
  closePanel: (panel: PanelType) => void;
  setMode: (mode: VisualMode) => void;
  setEarthOnlyMode: (active: boolean) => void;
  toggleEarthOnlyMode: () => void;
  setTimelineActive: (active: boolean) => void;
  setTimelinePosition: (date: Date) => void;
  setTimelineEvent: (event: HistoricalEvent | null) => void;
  setHelioSimulationSeconds: (seconds: number) => void;
  setHelioPlaybackRate: (rate: number) => void;
  setHelioSelectedPlaybackRate: (rate: number) => void;
  setHelioBurstIntensity: (intensity: number) => void;
  toggleHelioPlayback: () => void;
  resetHelioSimulation: () => void;
  newHelioSimulation: () => void;
  setStormAutoTriggered: (triggered: boolean) => void;
  setHelioSelectedCME: (index: number | null) => void;
  closeAllPanels: () => void;
  recordFeedUpdate: (feed: FeedKey) => void;
  setSourceDiagnostics: (rows: SourceDiagnostic[]) => void;
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
  feedLastUpdated: { satellites: null, conjunctions: null, spaceWeather: null },
  sourceDiagnostics: [],

  currentMode: "OPS",
  earthOnlyMode: false,
  timelineActive: false,
  timelinePosition: new Date(),
  timelineEvent: null,
  helioSimulationSeconds: 0,
  helioPlaybackRate: 0,
  helioSelectedPlaybackRate: 1,
  helioBurstIntensity: 1,
  helioScenarioVersion: 0,
  stormAutoTriggered: false,
  helioSelectedCME: null,

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
    }),
  setMode: (mode) => set({ currentMode: mode }),
  setEarthOnlyMode: (active) => set({ earthOnlyMode: active }),
  toggleEarthOnlyMode: () => set((state) => ({ earthOnlyMode: !state.earthOnlyMode })),
  setTimelineActive: (active) => set({ timelineActive: active }),
  setTimelinePosition: (date) => set({ timelinePosition: date }),
  setTimelineEvent: (event) => set({ timelineEvent: event }),
  setHelioSimulationSeconds: (seconds) => set({ helioSimulationSeconds: seconds }),
  setHelioPlaybackRate: (rate) =>
    set((state) => ({
      helioPlaybackRate: rate,
      helioSelectedPlaybackRate: rate > 0 ? rate : state.helioSelectedPlaybackRate
    })),
  setHelioSelectedPlaybackRate: (rate) =>
    set((state) => ({
      helioSelectedPlaybackRate: rate,
      helioPlaybackRate: state.helioPlaybackRate === 0 ? 0 : rate
    })),
  setHelioBurstIntensity: (intensity) => set({ helioBurstIntensity: intensity }),
  toggleHelioPlayback: () =>
    set((state) => ({
      helioPlaybackRate: state.helioPlaybackRate === 0 ? state.helioSelectedPlaybackRate : 0
    })),
  resetHelioSimulation: () =>
    set((state) => ({
      helioSimulationSeconds: 0,
      helioPlaybackRate: 0,
      helioSelectedPlaybackRate: state.helioSelectedPlaybackRate
    })),
  newHelioSimulation: () =>
    set((state) => ({
      helioSimulationSeconds: 0,
      helioPlaybackRate: 0,
      helioSelectedPlaybackRate: state.helioSelectedPlaybackRate,
      helioScenarioVersion: state.helioScenarioVersion + 1
    })),
  setStormAutoTriggered: (triggered) => set({ stormAutoTriggered: triggered }),
  setHelioSelectedCME: (index) => set({ helioSelectedCME: index }),
  closeAllPanels: () =>
    set({
      activePanels: new Set<PanelType>(),
      selectedSatellite: null,
      selectedConjunction: null
    }),
  recordFeedUpdate: (feed) =>
    set((state) => ({
      feedLastUpdated: { ...state.feedLastUpdated, [feed]: new Date() }
    })),
  setSourceDiagnostics: (rows) => set({ sourceDiagnostics: rows })
}));
