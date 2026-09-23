import { describe, expect, it } from "vitest";
import {
  cmeArrivalTextClass,
  cmePrimaryImpacts,
  formatCmeArrival,
  hasCmeArrived,
  isCmeMiss
} from "../cmeDisplay";

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

describe("isCmeMiss", () => {
  it("is true only for the clean-miss impact status", () => {
    expect(isCmeMiss({ impactStatus: "NO IMPACT — MISS" })).toBe(true);
  });

  it("is false for impacting statuses", () => {
    expect(isCmeMiss({ impactStatus: "DIRECT HIT" })).toBe(false);
    expect(isCmeMiss({ impactStatus: "GLANCING BLOW" })).toBe(false);
  });
});

describe("hasCmeArrived", () => {
  it("is true at or past zero hours to arrival", () => {
    expect(hasCmeArrived({ hoursUntilArrival: 0 })).toBe(true);
    expect(hasCmeArrived({ hoursUntilArrival: -3 })).toBe(true);
  });

  it("is false while arrival is still pending", () => {
    expect(hasCmeArrived({ hoursUntilArrival: 5 })).toBe(false);
  });
});

describe("cmeArrivalTextClass", () => {
  it("uses the alert colour for an already-arrived CME", () => {
    expect(cmeArrivalTextClass({ impactStatus: "DIRECT HIT", hoursUntilArrival: -2 })).toBe(
      "text-[#ff6644]"
    );
  });

  it("prefers the arrived colour over the miss colour when both apply", () => {
    expect(cmeArrivalTextClass({ impactStatus: "NO IMPACT — MISS", hoursUntilArrival: -1 })).toBe(
      "text-[#ff6644]"
    );
  });

  it("uses the calm colour for a pending clean miss", () => {
    expect(cmeArrivalTextClass({ impactStatus: "NO IMPACT — MISS", hoursUntilArrival: 20 })).toBe(
      "text-[#7dff6a]"
    );
  });

  it("uses the warning colour for a pending impact", () => {
    expect(cmeArrivalTextClass({ impactStatus: "GLANCING BLOW", hoursUntilArrival: 12 })).toBe(
      "text-[#ffcc88]"
    );
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
