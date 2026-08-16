import { beforeEach, describe, expect, it } from "vitest";
import type { Conjunction, Satellite } from "../../types/space";
import { useAuroraStore } from "../auroraStore";

const initialState = useAuroraStore.getState();

const satellite: Satellite = {
  noradId: 25544,
  name: "ISS",
  lat: 0,
  lon: 0,
  altitudeKm: 420,
  velocityKms: 7.66,
  orbitType: "LEO",
  riskLevel: "nominal",
  owner: "NASA",
  conjunctionCount: 0
};

const conjunction: Conjunction = {
  id: "c-1",
  object1: { noradId: 1, name: "A" },
  object2: { noradId: 2, name: "B" },
  tca: new Date("2026-01-01T00:00:00Z"),
  missDistanceKm: 1,
  missDistanceM: 1000,
  pc: 0.001,
  probability: 0.001,
  relativeVelocityKms: 7,
  riskLevel: "warning"
};

beforeEach(() => {
  useAuroraStore.setState(initialState, true);
});

describe("satellite selection", () => {
  it("opens the detail panel when a satellite is selected", () => {
    useAuroraStore.getState().setSelectedSatellite(satellite);
    const state = useAuroraStore.getState();
    expect(state.selectedSatellite).toBe(satellite);
    expect(state.activePanels.has("satellite-detail")).toBe(true);
  });

  it("closes the detail panel when the selection is cleared", () => {
    const store = useAuroraStore.getState();
    store.setSelectedSatellite(satellite);
    store.setSelectedSatellite(null);
    const state = useAuroraStore.getState();
    expect(state.selectedSatellite).toBeNull();
    expect(state.activePanels.has("satellite-detail")).toBe(false);
  });

  it("clears the selection when the detail panel is closed directly", () => {
    const store = useAuroraStore.getState();
    store.setSelectedSatellite(satellite);
    store.closePanel("satellite-detail");
    expect(useAuroraStore.getState().selectedSatellite).toBeNull();
  });
});

describe("conjunction selection", () => {
  it("opens the detail panel when a conjunction is selected", () => {
    useAuroraStore.getState().setSelectedConjunction(conjunction);
    const state = useAuroraStore.getState();
    expect(state.selectedConjunction).toBe(conjunction);
    expect(state.activePanels.has("conjunction-detail")).toBe(true);
  });

  it("closes the detail panel when the selection is cleared", () => {
    const store = useAuroraStore.getState();
    store.setSelectedConjunction(conjunction);
    store.setSelectedConjunction(null);
    const state = useAuroraStore.getState();
    expect(state.selectedConjunction).toBeNull();
    expect(state.activePanels.has("conjunction-detail")).toBe(false);
  });

  it("clears the selection when the detail panel is closed directly", () => {
    const store = useAuroraStore.getState();
    store.setSelectedConjunction(conjunction);
    store.closePanel("conjunction-detail");
    expect(useAuroraStore.getState().selectedConjunction).toBeNull();
  });
});
