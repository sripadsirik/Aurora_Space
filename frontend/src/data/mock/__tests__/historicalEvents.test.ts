import { describe, expect, it } from "vitest";
import { historicalEvents } from "../historicalEvents";

describe("historicalEvents dataset", () => {
  it("assigns a unique id to every event", () => {
    const ids = historicalEvents.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
