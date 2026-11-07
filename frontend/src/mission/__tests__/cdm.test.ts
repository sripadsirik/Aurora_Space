import { it, expect } from "vitest";
import { parseReviewImport } from "../../utils/conjunctionReview";
import { scenarioFromCdm } from "../cdm";
import { assessEncounter } from "../encounter";
import { analyzeMission } from "../analysis";
const header = `CCSDS_CDM_VERS = 1.0
CREATION_DATE = 2026-10-26T06:00:00
MESSAGE_ID = TEST-CDM
TCA = 2026-10-26T12:00:00
`;
const object = (i: number) => `OBJECT = OBJECT${i}
OBJECT_DESIGNATOR = ${100000 + i}
OBJECT_NAME = TEST-${i}
REF_FRAME = GCRF
X = ${i === 1 ? 6928.137 : 6928.222} [km]
Y = 0 [km]
Z = 0 [km]
X_DOT = 0 [km/s]
Y_DOT = ${i === 1 ? 7.585 : 4.3} [km/s]
Z_DOT = ${i === 1 ? 0 : 6.2} [km/s]
CR_R = 3600 [m**2]
CT_R = 0 [m**2]
CT_T = 14400 [m**2]
CN_R = 0 [m**2]
CN_T = 0 [m**2]
CN_N = 1600 [m**2]
`;
const velocity = `CRDOT_R = 0 [m**2/s]
CRDOT_T = 0 [m**2/s]
CRDOT_N = 0 [m**2/s]
CRDOT_RDOT = .0004 [m**2/s**2]
CTDOT_R = 0 [m**2/s]
CTDOT_T = 0 [m**2/s]
CTDOT_N = 0 [m**2/s]
CTDOT_RDOT = 0 [m**2/s**2]
CTDOT_TDOT = .0004 [m**2/s**2]
CNDOT_R = 0 [m**2/s]
CNDOT_T = 0 [m**2/s]
CNDOT_N = 0 [m**2/s]
CNDOT_RDOT = 0 [m**2/s**2]
CNDOT_TDOT = 0 [m**2/s**2]
CNDOT_NDOT = .0004 [m**2/s**2]
`;
it("imports CDM with full rotated state covariance and no fabricated supplied metrics", () => {
  const report = parseReviewImport(
    header + object(1) + velocity + object(2) + velocity,
    "test.cdm",
  )[0];
  const s = scenarioFromCdm(report, [4, 2]);
  expect(s.primary.stateCovariance).toHaveLength(6);
  expect(s.revisions[0].missDistanceM).toBeNull();
  expect(s.config.burnExecutionSigmaMs).toBeNull();
  expect(assessEncounter(s.primary, s.secondary).missDistanceM).toBeCloseTo(
    85,
    6,
  );
  s.config.burnExecutionSigmaMs = 0.02;
  expect(analyzeMission(s).candidates.every((c) => c.computedPc !== null)).toBe(
    true,
  );
});
it("supports position-only CDMs with candidate Pc explicitly unavailable", () => {
  const s = scenarioFromCdm(
    parseReviewImport(header + object(1) + object(2), "test.cdm")[0],
    [4, 2],
  );
  expect(s.primary.stateCovariance).toBeUndefined();
  expect(analyzeMission(s).candidates.every((c) => c.computedPc === null)).toBe(
    true,
  );
});
it("rejects partial covariance, mixed frames, incompatible units and epoch", () => {
  for (const text of [
    header + object(1) + "CRDOT_R = 0\n" + object(2),
    header + object(1) + object(2).replace("GCRF", "EME2000"),
    header + object(1).replace("3600 [m**2]", "3600 [km**2]") + object(2),
    header + object(1) + "EPOCH = 2026-10-25T12:00:00\n" + object(2),
  ]) {
    expect(() =>
      scenarioFromCdm(parseReviewImport(text, "bad.cdm")[0], [4, 2]),
    ).toThrow();
  }
});
