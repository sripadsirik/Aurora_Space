import { beforeEach, describe, expect, it } from "vitest";
import type { HistoricalEvent } from "../../types/space";
import { useAuroraStore } from "../auroraStore";

const initialState = useAuroraStore.getState();

beforeEach(() => {
  useAuroraStore.setState(initialState, true);
});

describe("setTimelineActive", () => {
  it("enables the timeline", () => {
    expect(useAuroraStore.getState().timelineActive).toBe(false);
    useAuroraStore.getState().setTimelineActive(true);
    expect(useAuroraStore.getState().timelineActive).toBe(true);
  });

  it("disables the timeline again", () => {
    const store = useAuroraStore.getState();
    store.setTimelineActive(true);
    store.setTimelineActive(false);
    expect(useAuroraStore.getState().timelineActive).toBe(false);
  });
});
