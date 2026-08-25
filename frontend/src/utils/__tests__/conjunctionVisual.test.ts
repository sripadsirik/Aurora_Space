import { Color } from "cesium";
import { describe, expect, it } from "vitest";
import {
  CRITICAL_CONJUNCTION_COLOR,
  WARNING_CONJUNCTION_COLOR,
  WATCH_CONJUNCTION_COLOR,
  getConjunctionColor,
  getConjunctionLineWidth
} from "../conjunctionVisual";

describe("conjunction risk palette", () => {
  it("increases opacity with severity", () => {
    expect(WATCH_CONJUNCTION_COLOR.alpha).toBeLessThan(WARNING_CONJUNCTION_COLOR.alpha);
    expect(WARNING_CONJUNCTION_COLOR.alpha).toBeLessThan(CRITICAL_CONJUNCTION_COLOR.alpha);
  });

  it("renders the critical tier as fully opaque red", () => {
    expect(CRITICAL_CONJUNCTION_COLOR.alpha).toBe(1);
    expect(CRITICAL_CONJUNCTION_COLOR.red).toBe(1);
  });
});

describe("getConjunctionColor", () => {
  it("maps each risk tier to its palette colour", () => {
    expect(getConjunctionColor("critical").equals(CRITICAL_CONJUNCTION_COLOR)).toBe(true);
    expect(getConjunctionColor("warning").equals(WARNING_CONJUNCTION_COLOR)).toBe(true);
    expect(getConjunctionColor("watch").equals(WATCH_CONJUNCTION_COLOR)).toBe(true);
  });

  it("renders the nominal tier as fully transparent", () => {
    expect(getConjunctionColor("nominal").equals(Color.TRANSPARENT)).toBe(true);
  });

  it("returns a fresh clone so callers cannot mutate the shared palette", () => {
    const color = getConjunctionColor("critical");
    color.alpha = 0.2;
    expect(CRITICAL_CONJUNCTION_COLOR.alpha).toBe(1);
  });
});

describe("getConjunctionLineWidth", () => {
  it("draws the watch tier thinner than the actionable tiers", () => {
    expect(getConjunctionLineWidth("watch")).toBe(2);
  });

  it("uses the wider stroke for warning, critical, and nominal tiers", () => {
    expect(getConjunctionLineWidth("warning")).toBe(3);
    expect(getConjunctionLineWidth("critical")).toBe(3);
    expect(getConjunctionLineWidth("nominal")).toBe(3);
  });
});
