import { describe, expect, it } from "vitest";
import type { ConjunctionWarning, Satellite } from "../../types/space";
import { conjunctionPeerName, formatConjunctionPairLabel } from "../conjunctionLabels";

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
