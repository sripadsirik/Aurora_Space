import { it, expect } from "vitest";
import {
  positionJacobian,
  mapPositionCovariance,
  validateStateCovariance,
  candidateProbability,
} from "../uncertainty";
import { demoScenario } from "../scenario";
import { simulateManeuver, analyzeMission } from "../analysis";
import type { Vec3 } from "../types";
it("state transition covariance agrees with analytic free drift", () => {
  const state = { r: [7e6, 0, 0] as Vec3, v: [0, 7500, 0] as Vec3 };
  const t = 100;
  const phi = positionJacobian(state, (s) => ({
    r: s.r.map((r, i) => r + s.v[i] * t) as Vec3,
    v: s.v,
  }));
  const p = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => (i === j ? (i < 3 ? 100 : 0.01) : 0)),
  );
  validateStateCovariance(p);
  const result = mapPositionCovariance(phi, p);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      expect(result[i][j]).toBeCloseTo(i === j ? 200 : 0, 5);
});
it("requires full covariance and explicit burn uncertainty", () => {
  const s = demoScenario(),
    candidate = simulateManeuver(s, [0, 1, 0], "test", "test");
  s.config.burnExecutionSigmaMs = null;
  expect(candidateProbability(s, candidate).pc).toBeNull();
  s.config.burnExecutionSigmaMs = 0.01;
  delete s.primary.stateCovariance;
  expect(candidateProbability(s, candidate).pc).toBeNull();
});
it("coast Pc agrees with baseline and candidate probabilities remain bounded", () => {
  const result = analyzeMission(demoScenario());
  expect(result.candidates[0].computedPc!).toBeCloseTo(result.encounter.pc, 8);
  expect(
    result.candidates.every(
      (c) => c.computedPc !== null && c.computedPc! >= 0 && c.computedPc! <= 1,
    ),
  ).toBe(true);
});
