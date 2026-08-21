import { describe, expect, it } from "vitest";
import { TIMELINE_SNAP_TOLERANCE, findNearestEvent } from "../timelineEvents";

interface Marker {
  id: string;
  fraction: number;
}

const fractionOf = (marker: Marker): number => marker.fraction;

const markers: Marker[] = [
  { id: "a", fraction: 0.1 },
  { id: "b", fraction: 0.5 },
  { id: "c", fraction: 0.505 }
];

describe("findNearestEvent", () => {
  it("returns the closest event within tolerance", () => {
    const nearest = findNearestEvent(markers, 0.503, fractionOf, 0.01);
    expect(nearest?.id).toBe("c");
  });

  it("returns null when no event is within tolerance", () => {
    expect(findNearestEvent(markers, 0.3, fractionOf, 0.01)).toBeNull();
  });

  it("returns null for an empty event list", () => {
    expect(findNearestEvent([], 0.5, fractionOf)).toBeNull();
  });

  it("includes an event just inside tolerance and excludes one just outside", () => {
    const one: Marker[] = [{ id: "only", fraction: 0.5 }];
    expect(findNearestEvent(one, 0.515, fractionOf, 0.02)?.id).toBe("only");
    expect(findNearestEvent(one, 0.53, fractionOf, 0.02)).toBeNull();
  });

  it("resolves ties to the earliest event in the list", () => {
    const tied: Marker[] = [
      { id: "left", fraction: 0.49 },
      { id: "right", fraction: 0.51 }
    ];
    expect(findNearestEvent(tied, 0.5, fractionOf, 0.05)?.id).toBe("left");
  });

  it("defaults to the shared snap tolerance", () => {
    const near: Marker[] = [{ id: "only", fraction: 0.5 + TIMELINE_SNAP_TOLERANCE / 2 }];
    expect(findNearestEvent(near, 0.5, fractionOf)?.id).toBe("only");
  });
});
