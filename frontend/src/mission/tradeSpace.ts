import { diskProbability, encounterPlane } from "./encounter";
import { propagateState } from "./dynamics";
import { add, dot, rtnBasis, scale, sub } from "./math";
import type {
  EncounterResult,
  ManeuverResult,
  MissionScenario,
  StateVector,
  TradeAxis,
  TradeSpace,
  Vec3,
} from "./types";

export const TRADE_AXES: TradeAxis[] = ["transverse", "radial", "normal"];
const AXIS_INDEX: Record<TradeAxis, number> = {
  radial: 0,
  transverse: 1,
  normal: 2,
};
export const DEFAULT_PC_ACTION_THRESHOLD = 1e-4;
export const DEFAULT_PC_GOAL = 1e-6;
/** Grid quadrature resolution; tests bound its difference from 64 × 64. */
export const TRADE_RESOLUTION = 32;
export const pcThresholds = (s: MissionScenario) => ({
  action: s.config.pcActionThreshold ?? DEFAULT_PC_ACTION_THRESHOLD,
  goal: s.config.pcGoal ?? DEFAULT_PC_GOAL,
});

/** Forward-difference sensitivity of primary position at TCA to an RTN impulse at
 * burn time. Columns are inertial displacement per m/s along R, T and N. The
 * map is linear to ~Δv / orbital speed, so the one-sided error is negligible. */
export function impulseSensitivity(
  atBurn: StateVector,
  duration: number,
  s: MissionScenario,
): [Vec3, Vec3, Vec3] {
  const h = 0.01,
    c = s.config;
  const kick = (dv: Vec3) =>
    propagateState(
      { r: atBurn.r, v: add(atBurn.v, dv) },
      duration,
      c.stepSeconds,
      c.forceModel,
    ).r;
  const base = kick([0, 0, 0]);
  return rtnBasis(atBurn.r, atBurn.v).map((direction) =>
    scale(sub(kick(scale(direction, h)), base), 1 / h),
  ) as [Vec3, Vec3, Vec3];
}

/** Encounter-plane miss and Pc for a linearly mapped impulse. The baseline position
 * covariance is retained; isotropic burn execution error is mapped and added. */
export function linearEncounter(
  encounter: EncounterResult,
  relativeVelocity: Vec3,
  columns: [Vec3, Vec3, Vec3],
  deltaVRtn: Vec3,
  sigma: number | null,
  resolution = 64,
) {
  const [x, y] = encounterPlane(relativeVelocity);
  const shift = columns.reduce(
    (sum, column, k) => add(sum, scale(column, deltaVRtn[k])),
    [0, 0, 0] as Vec3,
  );
  const mean: [number, number] = [
    encounter.mean[0] - dot(shift, x),
    encounter.mean[1] - dot(shift, y),
  ];
  const [[a, b], [, d]] = encounter.covariance;
  let ca = a,
    cb = b,
    cd = d;
  if (sigma && deltaVRtn.some((v) => v !== 0))
    for (const column of columns) {
      const px = dot(column, x),
        py = dot(column, y),
        s2 = sigma * sigma;
      ca += px * px * s2;
      cb += px * py * s2;
      cd += py * py * s2;
    }
  // Every density sample underflows once the disk's nearest point lies beyond
  // exp(−745) along the widest axis; skipping quadrature then returns the same 0.
  const radius = encounter.hardBodyRadiusM,
    widest = (ca + cd + Math.hypot(ca - cd, 2 * cb)) / 2,
    gap = Math.max(0, Math.hypot(...mean) - radius);
  const pc =
    sigma === null && deltaVRtn.some((v) => v !== 0)
      ? null
      : (gap * gap) / (2 * widest) > 745
        ? 0
        : diskProbability(
            mean,
            [
              [ca, cb],
              [cb, cd],
            ],
            radius,
            resolution,
          );
  return { missM: Math.hypot(...mean), pc };
}

export function computeTradeSpace(
  s: MissionScenario,
  encounter: EncounterResult,
  candidates: ManeuverResult[],
): TradeSpace {
  const c = s.config,
    { goal } = pcThresholds(s),
    sigma = c.burnExecutionSigmaMs;
  const relativeVelocity = sub(s.secondary.state.v, s.primary.state.v);
  const tca = encounter.timeOffsetSeconds;
  const leadsSeconds: number[] = [];
  for (let lead = 300; lead <= 7200; lead += 300)
    if (lead > c.encounterWindowSeconds) leadsSeconds.push(lead);
  const half = 20;
  const deltaVMs = Array.from(
    { length: 2 * half + 1 },
    (_, i) => (c.maxDeltaVMs * (i - half)) / half,
  );
  // Walk backwards once; each row then needs six forward propagations.
  const columnsByLead: [Vec3, Vec3, Vec3][] = [];
  let state = s.primary.state,
    at = 0;
  for (const lead of leadsSeconds) {
    state = propagateState(state, -lead - at, c.stepSeconds, c.forceModel);
    at = -lead;
    columnsByLead.push(impulseSensitivity(state, lead + tca, s));
  }
  const vector = (axis: TradeAxis, dv: number): Vec3 => {
    const v: Vec3 = [0, 0, 0];
    v[AXIS_INDEX[axis]] = dv;
    return v;
  };
  const axes = TRADE_AXES.map((axis) => {
    const evaluate = (row: number, dv: number) =>
      linearEncounter(
        encounter,
        relativeVelocity,
        columnsByLead[row],
        vector(axis, dv),
        sigma,
        TRADE_RESOLUTION,
      );
    const cells = columnsByLead.map((_, row) =>
      deltaVMs.map((dv) => evaluate(row, dv)),
    );
    const minDeltaVForGoalMs = columnsByLead.map((_, row) => {
      // Coast has no execution error and can already satisfy the goal. Check
      // it before considering noisy burns or requiring a burn uncertainty.
      if (cells[row][half].pc !== null && cells[row][half].pc! <= goal)
        return 0;
      if (sigma === null) return null;
      let best: number | null = null;
      for (const sign of [1, -1]) {
        // First grid magnitude meeting the goal, then bisect inside that bracket.
        const k = Array.from({ length: half }, (_, i) => i + 1).find(
          (i) => (cells[row][half + sign * i].pc ?? 1) <= goal,
        );
        if (k === undefined) continue;
        let lo = ((k - 1) * c.maxDeltaVMs) / half,
          hi = (k * c.maxDeltaVMs) / half;
        for (let i = 0; i < 14; i++) {
          const mid = (lo + hi) / 2;
          if ((evaluate(row, sign * mid).pc ?? 1) <= goal) hi = mid;
          else lo = mid;
        }
        if (best === null || hi < Math.abs(best)) best = sign * hi;
      }
      return best;
    });
    return {
      axis,
      missM: cells.map((row) => row.map((cell) => cell.missM)),
      pc:
        sigma === null
          ? null
          : cells.map((row) => row.map((cell) => cell.pc ?? 0)),
      minDeltaVForGoalMs,
    };
  });
  // Validate the linear map against the full nonlinear RK4 candidates.
  let maxMissErrorM = 0,
    maxRelativeError = 0;
  const leadColumns = new Map<number, [Vec3, Vec3, Vec3]>();
  for (const candidate of candidates) {
    const lead = candidate.burnLeadSeconds;
    if (!leadColumns.has(lead)) {
      const atBurn = propagateState(
        s.primary.state,
        -lead,
        c.stepSeconds,
        c.forceModel,
      );
      leadColumns.set(lead, impulseSensitivity(atBurn, lead + tca, s));
    }
    const linear = linearEncounter(
      encounter,
      relativeVelocity,
      leadColumns.get(lead)!,
      candidate.deltaVRtn,
      null,
    );
    const error = Math.abs(linear.missM - candidate.missDistanceM);
    maxMissErrorM = Math.max(maxMissErrorM, error);
    maxRelativeError = Math.max(
      maxRelativeError,
      error / Math.max(candidate.missDistanceM, 1),
    );
  }
  return {
    leadsSeconds,
    deltaVMs,
    axes,
    pcGoal: goal,
    pcReason:
      sigma === null
        ? "Burn execution uncertainty is unspecified; trade space shows miss distance only"
        : `Baseline position covariance + isotropic ${sigma} m/s burn error, mapped linearly`,
    validation: {
      candidates: candidates.length,
      maxMissErrorM,
      maxRelativeError,
    },
  };
}
