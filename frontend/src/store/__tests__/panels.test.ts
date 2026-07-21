import { beforeEach, describe, expect, it } from "vitest";
import { useAuroraStore } from "../auroraStore";

const initialState = useAuroraStore.getState();

beforeEach(() => {
  useAuroraStore.setState(initialState, true);
});

describe("panel management", () => {
  it("opens a panel without disturbing others", () => {
    useAuroraStore.getState().openPanel("intel-analysis");
    useAuroraStore.getState().openPanel("storm-impact");
    const { activePanels } = useAuroraStore.getState();
    expect(activePanels.has("intel-analysis")).toBe(true);
    expect(activePanels.has("storm-impact")).toBe(true);
    expect(activePanels.size).toBe(2);
  });

  it("opening the same panel twice is idempotent", () => {
    useAuroraStore.getState().openPanel("intel-analysis");
    useAuroraStore.getState().openPanel("intel-analysis");
    expect(useAuroraStore.getState().activePanels.size).toBe(1);
  });

  it("closePanel removes only the named panel", () => {
    const store = useAuroraStore.getState();
    store.openPanel("intel-analysis");
    store.openPanel("storm-impact");
    store.closePanel("intel-analysis");
    const { activePanels } = useAuroraStore.getState();
    expect(activePanels.has("intel-analysis")).toBe(false);
    expect(activePanels.has("storm-impact")).toBe(true);
  });

  it("replaces the set reference instead of mutating in place", () => {
    const before = useAuroraStore.getState().activePanels;
    useAuroraStore.getState().openPanel("storm-impact");
    expect(useAuroraStore.getState().activePanels).not.toBe(before);
    expect(before.size).toBe(0);
  });

  it("closeAllPanels clears panels and selections", () => {
    const store = useAuroraStore.getState();
    store.openPanel("intel-analysis");
    store.closeAllPanels();
    const state = useAuroraStore.getState();
    expect(state.activePanels.size).toBe(0);
    expect(state.selectedSatellite).toBeNull();
    expect(state.selectedConjunction).toBeNull();
  });
});
