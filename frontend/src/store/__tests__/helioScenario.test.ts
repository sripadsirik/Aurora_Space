import { beforeEach, describe, expect, it } from "vitest";
import { useAuroraStore } from "../auroraStore";

const initialState = useAuroraStore.getState();

beforeEach(() => {
  useAuroraStore.setState(initialState, true);
});

describe("setHelioBurstIntensity", () => {
  it("stores the requested burst intensity", () => {
    useAuroraStore.getState().setHelioBurstIntensity(2.5);
    expect(useAuroraStore.getState().helioBurstIntensity).toBe(2.5);
  });
});

describe("setStormAutoTriggered", () => {
  it("marks the storm auto-trigger as fired", () => {
    expect(useAuroraStore.getState().stormAutoTriggered).toBe(false);
    useAuroraStore.getState().setStormAutoTriggered(true);
    expect(useAuroraStore.getState().stormAutoTriggered).toBe(true);
  });

  it("can reset the auto-trigger flag", () => {
    const store = useAuroraStore.getState();
    store.setStormAutoTriggered(true);
    store.setStormAutoTriggered(false);
    expect(useAuroraStore.getState().stormAutoTriggered).toBe(false);
  });
});

describe("setHelioSelectedCME", () => {
  it("selects a CME by index", () => {
    expect(useAuroraStore.getState().helioSelectedCME).toBeNull();
    useAuroraStore.getState().setHelioSelectedCME(3);
    expect(useAuroraStore.getState().helioSelectedCME).toBe(3);
  });

  it("clears the selection when passed null", () => {
    const store = useAuroraStore.getState();
    store.setHelioSelectedCME(3);
    store.setHelioSelectedCME(null);
    expect(useAuroraStore.getState().helioSelectedCME).toBeNull();
  });
});
