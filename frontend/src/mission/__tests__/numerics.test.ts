import { describe, it, expect } from "vitest";
import { sgp4, twoline2satrec } from "satellite.js";
import references from "../fixtures/vallado.json";
import { parseOMM } from "../../utils/omm";
import { assessEncounter, diskProbability } from "../encounter";
import { propagateState, MU, EARTH_RADIUS, specificEnergy } from "../dynamics";
import {
  norm,
  sub,
  scale,
  rotateCovariance,
  validateCovariance,
} from "../math";
import { analyzeMission, simulateManeuver } from "../analysis";
import { demoScenario } from "../scenario";
import type { Mat3, MissionObject, Vec3 } from "../types";

describe("independent SGP4 published reference vectors", () => {
  for (const c of references.cases)
    it(`Vallado ${c.id}: ${c.samples.length} TEME states`, () => {
      const record = twoline2satrec(c.tle[0], c.tle[1]);
      const omm = parseOMM(c.omm).record;
      for (const sample of c.samples) {
        const s = sgp4(record, sample.seconds / 60)!;
        const p = [s.position.x, s.position.y, s.position.z] as Vec3,
          v = [s.velocity.x, s.velocity.y, s.velocity.z] as Vec3;
        expect(
          norm(sub(p, sample.r as Vec3)),
          `TLE position t=${sample.seconds}`,
        ).toBeLessThan(1e-5);
        expect(
          norm(sub(v, sample.v as Vec3)),
          `TLE velocity t=${sample.seconds}`,
        ).toBeLessThan(1e-8);
        const o = sgp4(omm, sample.seconds / 60)!;
        // JS Date truncates OMM fractional epochs to milliseconds; deep-space epoch dependence remains tiny.
        expect(
          norm(
            sub([o.position.x, o.position.y, o.position.z], sample.r as Vec3),
          ),
          `OMM position t=${sample.seconds}`,
        ).toBeLessThan(0.001);
      }
    });
  it("preserves six-digit ID and rejects invalid frame/units", () => {
    const input = { ...references.cases[0].omm, NORAD_CAT_ID: 100001 };
    expect(parseOMM(input).record.satnum).toBe("100001");
    expect(() => parseOMM({ ...input, REF_FRAME: "GCRF" })).toThrow();
    expect(() => parseOMM({ ...input, MEAN_MOTION: null })).toThrow();
    expect(() => parseOMM(input, 5)).toThrow();
  });
});
describe("collision probability", () => {
  it("matches centered isotropic Gaussian disk closed form", () => {
    for (const radius of [1, 10, 100]) {
      const sigma = 40;
      expect(
        diskProbability(
          [0, 0],
          [
            [sigma * sigma, 0],
            [0, sigma * sigma],
          ],
          radius,
          128,
        ),
      ).toBeCloseTo(1 - Math.exp((-radius * radius) / (2 * sigma * sigma)), 7);
    }
  });
  it("matches NASA CARA Omitron circular HBR reference (km inputs converted to SI)", () => {
    // Numeric reference data: NASA CARA Pc2D_Foster_UnitTest.m, testCircularHBR.
    // https://github.com/nasa/CARA_Analysis_Tools/blob/master/DistributedMatlab/ProbabilityOfCollision/UnitTests/Pc2D_Foster_UnitTest.m
    const p: MissionObject = {
      id: "1",
      name: "reference primary",
      radiusM: 10,
      state: {
        r: scale([378.39559, 4305.721887, 5752.767554], 1000),
        v: scale([2.360800244, 5.580331936, -4.322349039], 1000),
      },
      covariance: [
        [44.5757544811362, 81.6751751052616, -67.8687662707124],
        [81.6751751052616, 158.453402956163, -128.616921644857],
        [-67.8687662707124, -128.616921644858, 105.490542562701],
      ].map((r) => r.map((v) => v * 1e6)) as Mat3,
    };
    const s: MissionObject = {
      id: "2",
      name: "reference secondary",
      radiusM: 10,
      state: {
        r: scale([374.5180598, 4307.560983, 5751.130418], 1000),
        v: scale([-5.388125081, -3.946827739, 3.322820358], 1000),
      },
      covariance: [
        [2.31067077720423, 1.69905293875632, -1.4170164577661],
        [1.69905293875632, 1.24957388457206, -1.04174164279599],
        [-1.4170164577661, -1.04174164279599, 0.869260558223714],
      ].map((r) => r.map((v) => v * 1e6)) as Mat3,
    };
    const expected = 2.70601573490125e-5;
    expect(Math.abs(assessEncounter(p, s).pc / expected - 1)).toBeLessThan(
      0.001,
    );
  });
  it("is invariant to a rigid coordinate rotation and swapping object order", () => {
    const s = demoScenario(),
      base = assessEncounter(s.primary, s.secondary);
    const basis: [Vec3, Vec3, Vec3] = [
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
    ];
    const rotate = (o: MissionObject): MissionObject => ({
      ...o,
      state: {
        r: [o.state.r[2], o.state.r[0], o.state.r[1]],
        v: [o.state.v[2], o.state.v[0], o.state.v[1]],
      },
      covariance: rotateCovariance(o.covariance, basis),
    });
    expect(
      assessEncounter(rotate(s.primary), rotate(s.secondary)).pc,
    ).toBeCloseTo(base.pc, 12);
    expect(assessEncounter(s.secondary, s.primary).pc).toBeCloseTo(base.pc, 12);
  });
  it("rejects indefinite covariance and slow co-orbital encounters", () => {
    expect(() =>
      validateCovariance([
        [1, 2, 0],
        [2, 1, 0],
        [0, 0, 1],
      ]),
    ).toThrow("positive definite");
    const s = demoScenario();
    s.secondary.state.v = [...s.primary.state.v];
    expect(() => assessEncounter(s.primary, s.secondary)).toThrow(
      "unsupported",
    );
  });
});
describe("trajectory integration and maneuver screening", () => {
  it("closes an analytical circular orbit and conserves energy", () => {
    const radius = EARTH_RADIUS + 550000,
      s = {
        r: [radius, 0, 0] as Vec3,
        v: [0, Math.sqrt(MU / radius), 0] as Vec3,
      };
    const period = 2 * Math.PI * Math.sqrt(radius ** 3 / MU),
      out = propagateState(s, period, 5, "two-body");
    expect(norm(sub(s.r, out.r))).toBeLessThan(0.01);
    expect(Math.abs(specificEnergy(out) / specificEnergy(s) - 1)).toBeLessThan(
      1e-9,
    );
  });
  it("converges under step refinement and round trips backwards", () => {
    const s = demoScenario(),
      a = propagateState(s.primary.state, 2700, 10, "J2"),
      b = propagateState(s.primary.state, 2700, 5, "J2");
    expect(norm(sub(a.r, b.r))).toBeLessThan(0.05);
    expect(
      norm(sub(propagateState(a, -2700, 10, "J2").r, s.primary.state.r)),
    ).toBeLessThan(0.05);
  });
  it("reproduces coast, resolves TCA and improves separation with candidates", () => {
    const s = demoScenario(),
      a = analyzeMission(s),
      coast = a.candidates[0];
    expect(coast.missDistanceM).toBeCloseTo(85, 0);
    expect(Math.abs(coast.tcaOffsetSeconds)).toBeLessThan(0.01);
    expect(coast.deltaVMs).toBe(0);
    expect(coast.fuelKg).toBe(0);
    expect(a.candidates.length).toBe(11);
    expect(
      Math.max(...a.candidates.map((c) => c.missDistanceM)),
    ).toBeGreaterThan(1000);
    expect(
      a.candidates.every(
        (c) => Number.isFinite(c.missDistanceM) && c.screening.length === 2,
      ),
    ).toBe(true);
    expect(simulateManeuver(s, [0, 0, 0], "coast", "Coast").missDistanceM).toBe(
      coast.missDistanceM,
    );
  });
  it("detects an encounter in the additional screening set", () => {
    const s = demoScenario();
    s.screeningObjects = [{ ...s.secondary, id: "third" }];
    const c = simulateManeuver(s, [0, 0, 0], "coast", "Coast");
    expect(c.screening[0].belowThreshold).toBe(true);
    expect(c.screening[0].minimumDistanceM).toBeCloseTo(85, 0);
  });
});
