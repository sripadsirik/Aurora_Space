import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeMission, simulateManeuver } from "../analysis";
import { createArchive, readArchive, validateScenario } from "../archive";
import { demoScenario } from "../scenario";
import { candidateProbability } from "../uncertainty";
import { linearEncounter, TRADE_RESOLUTION } from "../tradeSpace";
import { sub } from "../math";
import type { MissionScenario } from "../types";

const base = demoScenario();
const analysis = analyzeMission(base);
const trade = analysis.tradeSpace!;

describe("linearized trade space", () => {
  it("agrees with every full RK4 candidate within 1% miss distance", () => {
    expect(trade.validation.candidates).toBe(11);
    expect(trade.validation.maxRelativeError).toBeLessThan(0.01);
    expect(trade.validation.maxMissErrorM).toBeLessThan(5);
  });
  it("reproduces the baseline encounter at zero Δv", () => {
    const zero = trade.deltaVMs.indexOf(0);
    for (const axis of trade.axes) {
      expect(axis.missM[0][zero]).toBeCloseTo(
        analysis.encounter.missDistanceM,
        6,
      );
      expect(axis.pc![0][zero] / analysis.encounter.pc).toBeCloseTo(1, 6);
    }
  });
  it("grid quadrature matches 64 × 64 wherever Pc is numerically meaningful", () => {
    const relativeVelocity = sub(base.secondary.state.v, base.primary.state.v);
    const columns: [
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ] = [
      [1200, -300, 20],
      [-6000, 9000, 0],
      [0, 50, 700],
    ];
    let worst = 0;
    for (const dv of [-0.08, -0.03, -0.01, 0, 0.01, 0.03, 0.08])
      for (const k of [0, 1, 2]) {
        const v: [number, number, number] = [0, 0, 0];
        v[k] = dv;
        const args = [
          analysis.encounter,
          relativeVelocity,
          columns,
          v,
          0.01,
        ] as const;
        const coarse = linearEncounter(...args, TRADE_RESOLUTION).pc!,
          fine = linearEncounter(...args, 64).pc!;
        if (fine > 1e-30) worst = Math.max(worst, Math.abs(coarse / fine - 1));
      }
    expect(worst).toBeLessThan(1e-6);
  });
  it("finds the minimum along-track Δv that just reaches the Pc goal", () => {
    const transverse = trade.axes.find((a) => a.axis === "transverse")!;
    const row = trade.leadsSeconds.indexOf(2700);
    const dv = transverse.minDeltaVForGoalMs[row]!;
    expect(Math.abs(dv)).toBeGreaterThan(0.01);
    expect(Math.abs(dv)).toBeLessThan(0.25);
    // Verify the linear answer with the full nonlinear model and mapped covariance.
    const full = simulateManeuver(
      base,
      [0, dv * 1.05, 0],
      "check",
      "check",
      2700,
    );
    const pc = candidateProbability(base, full).pc!;
    expect(pc).toBeLessThan(trade.pcGoal * 10);
    const short = simulateManeuver(
      base,
      [0, dv * 0.7, 0],
      "short",
      "short",
      2700,
    );
    expect(candidateProbability(base, short).pc!).toBeGreaterThan(trade.pcGoal);
  });
  it("needs less along-track Δv the earlier the burn", () => {
    const transverse = trade.axes.find((a) => a.axis === "transverse")!;
    const at = (lead: number) =>
      Math.abs(
        transverse.minDeltaVForGoalMs[trade.leadsSeconds.indexOf(lead)]!,
      );
    expect(at(900)).toBeGreaterThan(at(2700));
    expect(at(2700)).toBeGreaterThan(at(5400));
  });
  it("withholds Pc when burn execution uncertainty is unspecified", () => {
    const s = demoScenario();
    s.config.burnExecutionSigmaMs = null;
    const a = analyzeMission(s);
    expect(a.tradeSpace!.axes.every((x) => x.pc === null)).toBe(true);
    expect(a.decision.status).toBe("insufficient-data");
  });
  it.each([1, null])(
    "returns zero Δv when coast meets the goal, with burn sigma %s",
    (sigma) => {
      const s = demoScenario();
      s.secondary.state.r[0] += 415;
      s.config.burnExecutionSigmaMs = sigma;
      const a = analyzeMission(s);
      expect(a.encounter.pc).toBeLessThan(a.tradeSpace!.pcGoal);
      expect(
        a.tradeSpace!.axes.every((axis) =>
          axis.minDeltaVForGoalMs.every((dv) => dv === 0),
        ),
      ).toBe(true);
      expect(a.decision.status).toBe("monitor");
      expect(a.decision.rationale.join(" ")).not.toContain("latest qualifying");
    },
  );
});

describe("decision", () => {
  it("recommends the lowest-Δv full RK4 candidate meeting the goal", () => {
    expect(analysis.decision.status).toBe("maneuver");
    const recommended = analysis.candidates.find(
      (c) => c.id === analysis.decision.recommendedId,
    )!;
    expect(recommended.computedPc!).toBeLessThanOrEqual(1e-6);
    const qualifying = analysis.candidates.filter(
      (c) =>
        c.deltaVMs > 0 &&
        c.computedPc != null &&
        c.computedPc <= 1e-6 &&
        c.screening.every((x) => !x.belowThreshold),
    );
    expect(recommended.deltaVMs).toBe(
      Math.min(...qualifying.map((c) => c.deltaVMs)),
    );
  });
  it("monitors when baseline Pc is below the action threshold", () => {
    const s = demoScenario();
    s.config.pcActionThreshold = 1e-3;
    const a = analyzeMission(s);
    expect(a.decision.status).toBe("monitor");
    expect(a.decision.recommendedId).toBeNull();
  });
  it("reports no feasible candidate when the goal is out of reach", () => {
    const s = demoScenario();
    s.config.pcGoal = 1e-300;
    s.config.maxDeltaVMs = 0.05;
    expect(analyzeMission(s).decision.status).toBe("no-feasible");
  });
});

describe("designed maneuvers", () => {
  const designed = (
    m: Partial<NonNullable<MissionScenario["customManeuvers"]>[number]>,
  ) =>
    validateScenario({
      ...demoScenario(),
      customManeuvers: [
        {
          id: "custom-a",
          label: "Design",
          deltaVRtn: [0, 0.1, 0],
          burnLeadSeconds: 5400,
          ...m,
        },
      ],
    });
  it("simulates with the same full model and can become the recommendation", () => {
    const a = analyzeMission(designed({}));
    const custom = a.candidates.find((c) => c.id === "custom-a")!;
    expect(custom.custom).toBe(true);
    expect(custom.burnLeadSeconds).toBe(5400);
    expect(custom.samples[0].seconds).toBe(-5400);
    expect(a.decision.recommendedId).toBe("custom-a");
  });
  it("matches a standard candidate exactly when the inputs coincide", () => {
    const a = analyzeMission(
      designed({ deltaVRtn: [0, -0.25, 0], burnLeadSeconds: 2700 }),
    );
    const custom = a.candidates.find((c) => c.id === "custom-a")!,
      standard = a.candidates.find((c) => c.id === "along-0.25--1")!;
    expect(custom.missDistanceM).toBe(standard.missDistanceM);
    expect(custom.computedPc).toBe(standard.computedPc);
  });
  it("rejects designs outside budget, timing or identity rules", () => {
    expect(() => designed({ deltaVRtn: [0, 2, 0] })).toThrow("budget");
    expect(() => designed({ burnLeadSeconds: 60 })).toThrow("burn lead");
    expect(() => designed({ burnLeadSeconds: 9000 })).toThrow("burn lead");
    expect(() => designed({ id: "coast" })).toThrow("custom-*");
  });
  it("round trips through a hashed archive with an early replay position", async () => {
    const s = designed({});
    const archive = await readArchive(
      JSON.stringify(await createArchive(s, "", "custom-a", -5000)),
    );
    expect(archive.scenario.customManeuvers).toHaveLength(1);
  });
});

it("still imports archives written by aurora-analysis-1.1.0", async () => {
  const text = readFileSync(
    resolve(__dirname, "../fixtures/pathfinder-v1.1.0.json"),
    "utf8",
  );
  const archive = await readArchive(text);
  expect(archive.modelVersion).toBe("aurora-analysis-1.1.0");
  expect(analyzeMission(archive.scenario).candidates).toHaveLength(11);
});
