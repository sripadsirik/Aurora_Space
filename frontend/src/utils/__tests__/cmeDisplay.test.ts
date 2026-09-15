import { describe, expect, it } from "vitest";
import {
  CME_MISS_STATUS,
  cmePrimaryImpacts,
  formatCmeArrival,
  isCmeArrived,
  isCmeMiss
} from "../cmeDisplay";

describe("CME_MISS_STATUS", () => {
  it("matches the impact-status literal used for a clean miss", () => {
    expect(CME_MISS_STATUS).toBe("NO IMPACT — MISS");
  });
});

describe("isCmeMiss", () => {
  it("is true for a clean miss", () => {
    expect(isCmeMiss({ impactStatus: "NO IMPACT — MISS" })).toBe(true);
  });

  it("is false for a direct hit", () => {
    expect(isCmeMiss({ impactStatus: "DIRECT HIT" })).toBe(false);
  });

  it("is false for a glancing blow", () => {
    expect(isCmeMiss({ impactStatus: "GLANCING BLOW" })).toBe(false);
  });
});

describe("isCmeArrived", () => {
  it("is false while the arrival is still in the future", () => {
    expect(isCmeArrived({ hoursUntilArrival: 6 })).toBe(false);
  });

  it("is true at the exact arrival moment", () => {
    expect(isCmeArrived({ hoursUntilArrival: 0 })).toBe(true);
  });

  it("is true once the arrival is in the past", () => {
    expect(isCmeArrived({ hoursUntilArrival: -4 })).toBe(true);
  });
});

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
