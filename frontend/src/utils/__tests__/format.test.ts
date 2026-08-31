import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConjunctionWarning } from "../../types/space";
import {
  formatConjunctionWarningLabel,
  formatCountdownToTca,
  formatDurationToTca,
  formatDynamicPressure,
  formatEclipseFraction,
  formatMagnetopauseStandoff,
  formatManeuverDeltaV,
  formatMissDistance,
  formatOrbitalPeriod,
  formatOrbitalSpeed,
  formatPassDuration,
  formatProbability,
  formatProtonFlux,
  formatSpecificEnergy,
  formatUtcTime,
  isCriticalConjunction
} from "../format";

const makeConjunction = (overrides: Partial<ConjunctionWarning> = {}): ConjunctionWarning => ({
  id: "c-1",
  object1: { noradId: 1, name: "A" },
  object2: { noradId: 2, name: "B" },
  tca: new Date("2026-01-01T00:00:00Z"),
  missDistanceKm: 1,
  missDistanceM: 1000,
  pc: 0.0001,
  probability: 0.0001,
  relativeVelocityKms: 7,
  riskLevel: "nominal",
  ...overrides
});

describe("formatUtcTime", () => {
  it("zero-pads hours, minutes and seconds and appends UTC", () => {
    expect(formatUtcTime(new Date("2026-07-21T04:05:09Z"))).toBe("04:05:09 UTC");
  });

  it("renders midday times without padding loss", () => {
    expect(formatUtcTime(new Date("2026-07-21T23:59:59Z"))).toBe("23:59:59 UTC");
  });
});

describe("formatProbability", () => {
  it("renders in exponential notation with one fraction digit", () => {
    expect(formatProbability(0.0012)).toBe("1.2e-3");
  });

  it("handles zero", () => {
    expect(formatProbability(0)).toBe("0.0e+0");
  });
});

describe("formatMissDistance", () => {
  it("renders sub-kilometre distances in whole metres", () => {
    expect(formatMissDistance(248)).toBe("248 m");
  });

  it("rounds fractional metres to the nearest whole metre", () => {
    expect(formatMissDistance(612.4)).toBe("612 m");
  });

  it("groups thousands with separators below the kilometre cutoff", () => {
    expect(formatMissDistance(8500)).toBe("8,500 m");
  });

  it("switches to kilometres with one fraction digit at 10 km and above", () => {
    expect(formatMissDistance(10000)).toBe("10.0 km");
    expect(formatMissDistance(12540)).toBe("12.5 km");
  });

  it("renders an em dash for negative or non-finite inputs", () => {
    expect(formatMissDistance(-5)).toBe("—");
    expect(formatMissDistance(NaN)).toBe("—");
    expect(formatMissDistance(Infinity)).toBe("—");
  });
});

describe("formatProtonFlux", () => {
  it("renders a whole proton flux with a pfu suffix", () => {
    expect(formatProtonFlux(42)).toBe("42 pfu");
  });

  it("rounds fractional flux to whole particles", () => {
    expect(formatProtonFlux(9.6)).toBe("10 pfu");
  });

  it("groups thousands with separators", () => {
    expect(formatProtonFlux(12500)).toBe("12,500 pfu");
  });

  it("renders an em dash for negative or non-finite inputs", () => {
    expect(formatProtonFlux(-1)).toBe("—");
    expect(formatProtonFlux(NaN)).toBe("—");
    expect(formatProtonFlux(Infinity)).toBe("—");
  });
});

describe("formatManeuverDeltaV", () => {
  it("scales linearly with probability and rounds to one decimal", () => {
    expect(formatManeuverDeltaV(0.0012)).toBe("~12.0 m/s");
    expect(formatManeuverDeltaV(0.00005)).toBe("~0.5 m/s");
  });

  it("renders a zero probability as zero delta-V", () => {
    expect(formatManeuverDeltaV(0)).toBe("~0.0 m/s");
  });
});

describe("isCriticalConjunction", () => {
  it("flags high collision probability", () => {
    expect(isCriticalConjunction(makeConjunction({ probability: 0.006, missDistanceM: 5000 }))).toBe(true);
  });

  it("flags very small miss distance", () => {
    expect(isCriticalConjunction(makeConjunction({ probability: 0, missDistanceM: 200 }))).toBe(true);
  });

  it("treats the thresholds as inclusive", () => {
    expect(isCriticalConjunction(makeConjunction({ probability: 0.005, missDistanceM: 10000 }))).toBe(true);
    expect(isCriticalConjunction(makeConjunction({ probability: 0, missDistanceM: 250 }))).toBe(true);
  });

  it("returns false for nominal conjunctions", () => {
    expect(isCriticalConjunction(makeConjunction({ probability: 0.001, missDistanceM: 5000 }))).toBe(false);
  });
});

describe("formatConjunctionWarningLabel", () => {
  it("uses the singular noun for exactly one warning", () => {
    expect(formatConjunctionWarningLabel(1)).toBe("1 ACTIVE CONJUNCTION WARNING");
  });

  it("uses the plural noun for zero or many warnings", () => {
    expect(formatConjunctionWarningLabel(0)).toBe("0 ACTIVE CONJUNCTION WARNINGS");
    expect(formatConjunctionWarningLabel(3)).toBe("3 ACTIVE CONJUNCTION WARNINGS");
  });

  it("clamps negative counts to zero", () => {
    expect(formatConjunctionWarningLabel(-4)).toBe("0 ACTIVE CONJUNCTION WARNINGS");
  });
});

describe("formatOrbitalPeriod", () => {
  it("renders a sub-hour period in whole minutes", () => {
    expect(formatOrbitalPeriod(45)).toBe("45m");
  });

  it("renders an hour-plus low Earth orbit period as hours and minutes", () => {
    expect(formatOrbitalPeriod(92)).toBe("1h 32m");
  });

  it("renders a geostationary period as hours and minutes", () => {
    expect(formatOrbitalPeriod(1436)).toBe("23h 56m");
  });

  it("rounds fractional minutes to the nearest minute", () => {
    expect(formatOrbitalPeriod(59.4)).toBe("59m");
    expect(formatOrbitalPeriod(59.6)).toBe("1h 0m");
  });

  it("clamps negative inputs to zero", () => {
    expect(formatOrbitalPeriod(-5)).toBe("0m");
  });
});

describe("formatOrbitalSpeed", () => {
  it("renders a circular orbital speed with two fraction digits and a km/s suffix", () => {
    expect(formatOrbitalSpeed(7.66)).toBe("7.66 km/s");
  });

  it("rounds to two fraction digits", () => {
    expect(formatOrbitalSpeed(11.186)).toBe("11.19 km/s");
  });

  it("pads a whole-number speed to two fraction digits", () => {
    expect(formatOrbitalSpeed(3)).toBe("3.00 km/s");
  });

  it("renders an em dash for negative or non-finite speeds", () => {
    expect(formatOrbitalSpeed(-1)).toBe("—");
    expect(formatOrbitalSpeed(Number.NaN)).toBe("—");
  });
});

describe("formatSpecificEnergy", () => {
  it("renders a bound orbit's energy as a negative MJ/kg value", () => {
    expect(formatSpecificEnergy(-29.3)).toBe("-29.3 MJ/kg");
  });

  it("rounds to one fraction digit", () => {
    expect(formatSpecificEnergy(-29.34)).toBe("-29.3 MJ/kg");
  });

  it("renders an em dash for non-finite inputs", () => {
    expect(formatSpecificEnergy(Number.NaN)).toBe("—");
    expect(formatSpecificEnergy(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatDynamicPressure", () => {
  it("renders a pressure with two fraction digits and a nPa suffix", () => {
    expect(formatDynamicPressure(1.338)).toBe("1.34 nPa");
  });

  it("keeps two fraction digits for a whole-number pressure", () => {
    expect(formatDynamicPressure(2)).toBe("2.00 nPa");
  });

  it("renders an em dash for negative or non-finite inputs", () => {
    expect(formatDynamicPressure(-1)).toBe("—");
    expect(formatDynamicPressure(Number.NaN)).toBe("—");
  });
});

describe("formatMagnetopauseStandoff", () => {
  it("renders a standoff distance with one fraction digit and an Earth-radii suffix", () => {
    expect(formatMagnetopauseStandoff(10.5)).toBe("10.5 Rₑ");
  });

  it("rounds to one fraction digit", () => {
    expect(formatMagnetopauseStandoff(6.63)).toBe("6.6 Rₑ");
  });

  it("renders an em dash for an infinite (unopposed) boundary", () => {
    expect(formatMagnetopauseStandoff(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("renders an em dash for negative or non-finite inputs", () => {
    expect(formatMagnetopauseStandoff(-1)).toBe("—");
    expect(formatMagnetopauseStandoff(Number.NaN)).toBe("—");
  });
});

describe("formatPassDuration", () => {
  it("renders a sub-minute pass in whole seconds", () => {
    expect(formatPassDuration(45)).toBe("45s");
  });

  it("renders a minutes-long pass as minutes and zero-padded seconds", () => {
    expect(formatPassDuration(522)).toBe("8m 42s");
    expect(formatPassDuration(305)).toBe("5m 05s");
  });

  it("renders an hour-plus contact window as hours and minutes", () => {
    expect(formatPassDuration(3900)).toBe("1h 5m");
  });

  it("rounds fractional seconds to the nearest second", () => {
    expect(formatPassDuration(59.4)).toBe("59s");
    expect(formatPassDuration(59.6)).toBe("1m 00s");
  });

  it("clamps negative and non-finite inputs to zero seconds", () => {
    expect(formatPassDuration(-10)).toBe("0s");
    expect(formatPassDuration(Number.NaN)).toBe("0s");
  });
});

describe("formatEclipseFraction", () => {
  it("renders a fraction as a rounded whole percent", () => {
    expect(formatEclipseFraction(0.373)).toBe("37%");
    expect(formatEclipseFraction(0.048)).toBe("5%");
  });

  it("clamps out-of-range inputs to 0 and 100 percent", () => {
    expect(formatEclipseFraction(-0.2)).toBe("0%");
    expect(formatEclipseFraction(1.4)).toBe("100%");
  });

  it("renders the exact endpoints", () => {
    expect(formatEclipseFraction(0)).toBe("0%");
    expect(formatEclipseFraction(1)).toBe("100%");
  });
});

describe("formatDurationToTca", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down hours and minutes for a future TCA", () => {
    expect(formatDurationToTca(new Date("2026-07-21T02:30:00Z"))).toBe("2h 30m");
  });

  it("accepts an ISO string as input", () => {
    expect(formatDurationToTca("2026-07-21T01:15:00Z")).toBe("1h 15m");
  });

  it("reports a recently passed TCA in hours and minutes", () => {
    expect(formatDurationToTca(new Date("2026-07-20T22:30:00Z"))).toBe("PASSED 1h 30m ago");
  });

  it("reports a long-passed TCA in days and hours", () => {
    expect(formatDurationToTca(new Date("2026-07-18T21:00:00Z"))).toBe("PASSED 2d 3h ago");
  });
});

describe("formatCountdownToTca", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a future TCA as a zero-padded HH:MM:SS clock", () => {
    expect(formatCountdownToTca(new Date("2026-07-21T02:03:04Z"))).toBe("02:03:04");
  });

  it("accepts an ISO string as input", () => {
    expect(formatCountdownToTca("2026-07-21T01:15:09Z")).toBe("01:15:09");
  });

  it("reports a recently passed TCA as a padded clock", () => {
    expect(formatCountdownToTca(new Date("2026-07-20T23:58:30Z"))).toBe("PASSED 00:01:30 ago");
  });

  it("switches to days and hours once a passed TCA is over a day old", () => {
    expect(formatCountdownToTca(new Date("2026-07-18T21:00:00Z"))).toBe("PASSED 2d 03h ago");
  });
});
