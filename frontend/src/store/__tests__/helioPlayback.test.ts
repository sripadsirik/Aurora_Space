import { beforeEach, describe, expect, it } from "vitest";
import { useAuroraStore } from "../auroraStore";

const initialState = useAuroraStore.getState();

beforeEach(() => {
  useAuroraStore.setState(initialState, true);
});

describe("setHelioPlaybackRate", () => {
  it("remembers a positive rate as the selected rate", () => {
    useAuroraStore.getState().setHelioPlaybackRate(4);
    const state = useAuroraStore.getState();
    expect(state.helioPlaybackRate).toBe(4);
    expect(state.helioSelectedPlaybackRate).toBe(4);
  });

  it("pausing (rate 0) preserves the previously selected rate", () => {
    const store = useAuroraStore.getState();
    store.setHelioPlaybackRate(8);
    store.setHelioPlaybackRate(0);
    const state = useAuroraStore.getState();
    expect(state.helioPlaybackRate).toBe(0);
    expect(state.helioSelectedPlaybackRate).toBe(8);
  });
});

describe("setHelioSelectedPlaybackRate", () => {
  it("updates the live rate when playback is running", () => {
    const store = useAuroraStore.getState();
    store.setHelioPlaybackRate(2);
    store.setHelioSelectedPlaybackRate(6);
    expect(useAuroraStore.getState().helioPlaybackRate).toBe(6);
  });

  it("stays paused when playback is stopped", () => {
    useAuroraStore.getState().setHelioSelectedPlaybackRate(6);
    const state = useAuroraStore.getState();
    expect(state.helioSelectedPlaybackRate).toBe(6);
    expect(state.helioPlaybackRate).toBe(0);
  });
});

describe("toggleHelioPlayback", () => {
  it("starts playback at the selected rate from a paused state", () => {
    const store = useAuroraStore.getState();
    store.setHelioSelectedPlaybackRate(3);
    store.toggleHelioPlayback();
    expect(useAuroraStore.getState().helioPlaybackRate).toBe(3);
  });

  it("pauses when toggled while running", () => {
    const store = useAuroraStore.getState();
    store.setHelioPlaybackRate(5);
    store.toggleHelioPlayback();
    expect(useAuroraStore.getState().helioPlaybackRate).toBe(0);
  });
});

describe("resetHelioSimulation", () => {
  it("rewinds and pauses while keeping the selected rate", () => {
    const store = useAuroraStore.getState();
    store.setHelioSimulationSeconds(1200);
    store.setHelioPlaybackRate(4);
    store.resetHelioSimulation();
    const state = useAuroraStore.getState();
    expect(state.helioSimulationSeconds).toBe(0);
    expect(state.helioPlaybackRate).toBe(0);
    expect(state.helioSelectedPlaybackRate).toBe(4);
  });
});

describe("newHelioSimulation", () => {
  it("resets the clock and bumps the scenario version", () => {
    const store = useAuroraStore.getState();
    const startVersion = useAuroraStore.getState().helioScenarioVersion;
    store.setHelioSimulationSeconds(900);
    store.newHelioSimulation();
    const state = useAuroraStore.getState();
    expect(state.helioSimulationSeconds).toBe(0);
    expect(state.helioScenarioVersion).toBe(startVersion + 1);
  });
});
