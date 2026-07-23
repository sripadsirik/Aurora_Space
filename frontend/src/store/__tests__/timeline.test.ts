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

describe("setTimelinePosition", () => {
  it("stores the scrubbed timeline date", () => {
    const target = new Date("2003-10-29T06:00:00Z");
    useAuroraStore.getState().setTimelinePosition(target);
    expect(useAuroraStore.getState().timelinePosition).toBe(target);
  });
});

const halloweenStorm: HistoricalEvent = {
  id: "2003-halloween",
  name: "Halloween Storms",
  date: new Date("2003-10-29T06:00:00Z"),
  description: "Severe geomagnetic storm sequence",
  type: "solar_storm",
  kpIndex: 9
};

describe("setTimelineEvent", () => {
  it("selects a historical event", () => {
    useAuroraStore.getState().setTimelineEvent(halloweenStorm);
    expect(useAuroraStore.getState().timelineEvent).toBe(halloweenStorm);
  });

  it("clears the selected event when passed null", () => {
    const store = useAuroraStore.getState();
    store.setTimelineEvent(halloweenStorm);
    store.setTimelineEvent(null);
    expect(useAuroraStore.getState().timelineEvent).toBeNull();
  });
});
