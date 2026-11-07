import { propagateState } from "./dynamics";
import { add, rtnBasis, scale } from "./math";
import { assessEncounter } from "./encounter";
import type {
  Mat3,
  MissionScenario,
  StateVector,
  Vec3,
  ManeuverResult,
} from "./types";

export function validateStateCovariance(matrix: number[][]): void {
  if (
    !Array.isArray(matrix) ||
    matrix.length !== 6 ||
    !matrix.every(
      (r) => Array.isArray(r) && r.length === 6 && r.every(Number.isFinite),
    )
  )
    throw new Error("State covariance requires a finite 6 × 6 matrix");
  const l = Array.from({ length: 6 }, () => Array(6).fill(0));
  for (let i = 0; i < 6; i++)
    for (let j = 0; j <= i; j++) {
      if (
        Math.abs(matrix[i][j] - matrix[j][i]) >
        1e-10 * Math.max(1, Math.abs(matrix[i][j]), Math.abs(matrix[j][i]))
      )
        throw new Error("State covariance must be symmetric");
      let v = matrix[i][j];
      for (let k = 0; k < j; k++) v -= l[i][k] * l[j][k];
      if (i === j) {
        if (v <= 0)
          throw new Error("State covariance must be positive definite");
        l[i][j] = Math.sqrt(v);
      } else l[i][j] = v / l[j][j];
    }
}
function perturbed(s: StateVector, axis: number, epsilon: number): StateVector {
  const result = { r: [...s.r] as Vec3, v: [...s.v] as Vec3 };
  if (axis < 3) result.r[axis] += epsilon;
  else result.v[axis - 3] += epsilon;
  return result;
}
/** Central finite-difference state transition. Rows are final position components;
 * columns are initial position [m] and velocity [m/s]. */
export function positionJacobian(
  s: StateVector,
  map: (s: StateVector) => StateVector,
  scaleFactor = 1,
): number[][] {
  const phi = Array.from({ length: 3 }, () => Array(6).fill(0));
  for (let j = 0; j < 6; j++) {
    const h = (j < 3 ? 1 : 0.001) * scaleFactor;
    const a = map(perturbed(s, j, h)),
      b = map(perturbed(s, j, -h));
    for (let i = 0; i < 3; i++) phi[i][j] = (a.r[i] - b.r[i]) / (2 * h);
  }
  return phi;
}
export function mapPositionCovariance(phi: number[][], p: number[][]): Mat3 {
  return [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) => {
      let sum = 0;
      for (let a = 0; a < 6; a++)
        for (let b = 0; b < 6; b++) sum += phi[i][a] * p[a][b] * phi[j][b];
      return sum;
    }),
  ) as Mat3;
}
export function candidateProbability(
  s: MissionScenario,
  candidate: ManeuverResult,
): { pc: number | null; reason: string } {
  const p = s.primary.stateCovariance,
    q = s.secondary.stateCovariance;
  if (!p || !q)
    return { pc: null, reason: "Full 6 × 6 state covariances are required" };
  const c = s.config,
    sigma = c.burnExecutionSigmaMs;
  if (candidate.deltaVMs > 0 && (sigma === null || sigma === undefined))
    return { pc: null, reason: "Burn execution uncertainty is unspecified" };
  validateStateCovariance(p);
  validateStateCovariance(q);
  const primaryMap = (
    initial: StateVector,
    noise: Vec3 = [0, 0, 0],
  ): StateVector => {
    const atBurn = propagateState(
      initial,
      -candidate.burnLeadSeconds,
      c.stepSeconds,
      c.forceModel,
    );
    const basis = rtnBasis(atBurn.r, atBurn.v),
      dv = candidate.deltaVRtn;
    const impulse = add(
      add(scale(basis[0], dv[0]), scale(basis[1], dv[1])),
      scale(basis[2], dv[2]),
    );
    return propagateState(
      { r: atBurn.r, v: add(add(atBurn.v, impulse), noise) },
      candidate.burnLeadSeconds + candidate.tcaOffsetSeconds,
      c.stepSeconds,
      c.forceModel,
    );
  };
  const secondaryMap = (initial: StateVector) =>
    propagateState(
      initial,
      candidate.tcaOffsetSeconds,
      c.stepSeconds,
      c.forceModel,
    );
  const a = mapPositionCovariance(
    positionJacobian(s.primary.state, primaryMap),
    p,
  );
  const b = mapPositionCovariance(
    positionJacobian(s.secondary.state, secondaryMap),
    q,
  );
  if (
    candidate.deltaVMs > 0 &&
    sigma !== null &&
    sigma !== undefined &&
    sigma > 0
  ) {
    const h = 0.001;
    for (let axis = 0; axis < 3; axis++) {
      const plus: Vec3 = [0, 0, 0],
        minus: Vec3 = [0, 0, 0];
      plus[axis] = h;
      minus[axis] = -h;
      const hi = primaryMap(s.primary.state, plus),
        lo = primaryMap(s.primary.state, minus);
      const jac = hi.r.map((v, i) => (v - lo.r[i]) / (2 * h));
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) a[i][j] += jac[i] * jac[j] * sigma * sigma;
    }
  }
  try {
    const assessment = assessEncounter(
      { ...s.primary, state: candidate.primaryAtTca, covariance: a },
      { ...s.secondary, state: candidate.secondaryAtTca, covariance: b },
    );
    return {
      pc: assessment.pc,
      reason:
        assessment.pc === 0
          ? "Below floating-point probability range; not an exact zero-risk statement"
          : "Linearized 6D state covariance + independent isotropic burn error; 2D short-encounter Pc",
    };
  } catch (e) {
    return {
      pc: null,
      reason:
        e instanceof Error ? e.message : "Candidate probability unavailable",
    };
  }
}
