import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuroraStore } from "../auroraStore";

const initialState = useAuroraStore.getState();

beforeEach(() => {
  useAuroraStore.setState(initialState, true);
});

describe("recordFeedUpdate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stamps only the named feed and leaves the others untouched", () => {
    useAuroraStore.getState().recordFeedUpdate("satellites");
    const { feedLastUpdated } = useAuroraStore.getState();
    expect(feedLastUpdated.satellites).toEqual(new Date("2026-07-21T12:00:00Z"));
    expect(feedLastUpdated.conjunctions).toBeNull();
    expect(feedLastUpdated.spaceWeather).toBeNull();
  });
});

describe("visual mode", () => {
  it("setMode replaces the current mode", () => {
    useAuroraStore.getState().setMode("HELIO");
    expect(useAuroraStore.getState().currentMode).toBe("HELIO");
  });

  it("setEarthOnlyMode sets the flag explicitly", () => {
    const store = useAuroraStore.getState();
    store.setEarthOnlyMode(true);
    expect(useAuroraStore.getState().earthOnlyMode).toBe(true);
    store.setEarthOnlyMode(false);
    expect(useAuroraStore.getState().earthOnlyMode).toBe(false);
  });

  it("toggleEarthOnlyMode flips the flag", () => {
    const store = useAuroraStore.getState();
    expect(useAuroraStore.getState().earthOnlyMode).toBe(false);
    store.toggleEarthOnlyMode();
    expect(useAuroraStore.getState().earthOnlyMode).toBe(true);
    store.toggleEarthOnlyMode();
    expect(useAuroraStore.getState().earthOnlyMode).toBe(false);
  });
});

describe("setSourceDiagnostics", () => {
  it("replaces the diagnostics rows", () => {
    const rows = [{ source: "celestrak", status: "ok" } as unknown as never];
    useAuroraStore.getState().setSourceDiagnostics(rows);
    expect(useAuroraStore.getState().sourceDiagnostics).toBe(rows);
  });
});
