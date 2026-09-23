import { describe, expect, it } from "vitest";
import type { ConjunctionWarning, Satellite } from "../../types/space";
import {
  conjunctionPeerName,
  conjunctionsForSatellite,
  formatConjunctionPairLabel,
  involvesSatellite
} from "../conjunctionLabels";

const pair: Pick<ConjunctionWarning, "object1" | "object2"> = {
  object1: { noradId: 25544, name: "ISS" },
  object2: { noradId: 12345, name: "COSMOS-2251-DEB" }
};

describe("formatConjunctionPairLabel", () => {
  it("joins the two object names with the default separator", () => {
    expect(formatConjunctionPairLabel(pair)).toBe("ISS x COSMOS-2251-DEB");
  });

  it("honours a custom separator for prose contexts", () => {
    expect(formatConjunctionPairLabel(pair, "-")).toBe("ISS - COSMOS-2251-DEB");
  });
});

describe("conjunctionPeerName", () => {
  const satellite = { noradId: 25544 } as Pick<Satellite, "noradId">;

  it("returns object2 when the satellite is object1", () => {
    expect(conjunctionPeerName(satellite, pair)).toBe("COSMOS-2251-DEB");
  });

  it("returns object1 when the satellite is object2", () => {
    expect(conjunctionPeerName({ noradId: 12345 }, pair)).toBe("ISS");
  });

  it("falls back to object1 when the satellite is not in the pair", () => {
    expect(conjunctionPeerName({ noradId: 99999 }, pair)).toBe("ISS");
  });
});

describe("involvesSatellite", () => {
  it("matches when the satellite is object1", () => {
    expect(involvesSatellite({ noradId: 25544 }, pair)).toBe(true);
  });

  it("matches when the satellite is object2", () => {
    expect(involvesSatellite({ noradId: 12345 }, pair)).toBe(true);
  });

  it("does not match a satellite absent from the pair", () => {
    expect(involvesSatellite({ noradId: 99999 }, pair)).toBe(false);
  });
});

describe("conjunctionsForSatellite", () => {
  const other: Pick<ConjunctionWarning, "object1" | "object2"> = {
    object1: { noradId: 40000, name: "STARLINK-1" },
    object2: { noradId: 40001, name: "STARLINK-2" }
  };

  it("keeps only conjunctions involving the satellite", () => {
    const result = conjunctionsForSatellite({ noradId: 25544 }, [pair, other]);
    expect(result).toEqual([pair]);
  });

  it("returns an empty array when none involve the satellite", () => {
    expect(conjunctionsForSatellite({ noradId: 99999 }, [pair, other])).toEqual([]);
  });

  it("preserves input order for multiple matches", () => {
    const second: Pick<ConjunctionWarning, "object1" | "object2"> = {
      object1: { noradId: 25544, name: "ISS" },
      object2: { noradId: 55555, name: "DEBRIS" }
    };
    expect(conjunctionsForSatellite({ noradId: 25544 }, [pair, other, second])).toEqual([pair, second]);
  });

  it("does not mutate the input list", () => {
    const input = [pair, other];
    conjunctionsForSatellite({ noradId: 25544 }, input);
    expect(input).toHaveLength(2);
  });
});
