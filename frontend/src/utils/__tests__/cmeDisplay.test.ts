import { describe, expect, it } from "vitest";
import { cmePrimaryImpacts, formatCmeArrival } from "../cmeDisplay";

describe("formatCmeArrival", () => {
  it("describes a clean miss with the pass-by wording", () => {
    expect(
      formatCmeArrival({ impactStatus: "NO IMPACT — MISS", hoursUntilArrival: 30 })
    ).toBe("PASSES EARTH ORBIT IN 30h — NO IMPACT");
  });

  it("prefers the miss wording even when the miss time is in the past", () => {
    expect(
      formatCmeArrival({ impactStatus: "NO IMPACT — MISS", hoursUntilArrival: -4 })
    ).toBe("PASSES EARTH ORBIT IN -4h — NO IMPACT");
  });

  it("reports an already-arrived direct hit as elapsed hours", () => {
    expect(
      formatCmeArrival({ impactStatus: "DIRECT HIT", hoursUntilArrival: -6 })
    ).toBe("ARRIVED 6h ago");
  });

  it("treats an arrival exactly at zero hours as arrived", () => {
    expect(
      formatCmeArrival({ impactStatus: "DIRECT HIT", hoursUntilArrival: 0 })
    ).toBe("ARRIVED 0h ago");
  });

  it("counts down a pending direct hit without a prefix", () => {
    expect(
      formatCmeArrival({ impactStatus: "DIRECT HIT", hoursUntilArrival: 18 })
    ).toBe("18h until arrival");
  });

  it("prefixes a pending glancing blow", () => {
    expect(
      formatCmeArrival({ impactStatus: "GLANCING BLOW", hoursUntilArrival: 12 })
    ).toBe("GLANCING ARRIVAL — 12h until arrival");
  });
});

describe("cmePrimaryImpacts", () => {
  it("always includes HF radio and GPS effects for a mild storm", () => {
    expect(cmePrimaryImpacts({ predictedKp: 5 })).toEqual([
      "HF Radio degradation",
      "GPS accuracy reduction"
    ]);
  });

  it("adds power grid stress at Kp 7", () => {
    expect(cmePrimaryImpacts({ predictedKp: 7 })).toEqual([
      "HF Radio degradation",
      "GPS accuracy reduction",
      "Power grid stress"
    ]);
  });

  it("adds satellite charging risk at Kp 8", () => {
    expect(cmePrimaryImpacts({ predictedKp: 8 })).toEqual([
      "HF Radio degradation",
      "GPS accuracy reduction",
      "Power grid stress",
      "Satellite charging risk"
    ]);
  });
});
