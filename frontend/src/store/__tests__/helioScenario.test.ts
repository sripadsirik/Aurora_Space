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
