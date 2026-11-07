import { candidateProbability } from "./uncertainty";
import { assessEncounter } from "./encounter";
import { propagateState, rk4 } from "./dynamics";
import { add, dot, norm, rtnBasis, scale, sub } from "./math";
import { computeTradeSpace, pcThresholds } from "./tradeSpace";
import { decide } from "./decision";
import type {
  ManeuverResult,
  MissionAnalysis,
  MissionScenario,
  StateVector,
  TradeSpace,
  Vec3,
} from "./types";
export const MODEL_VERSION = "aurora-analysis-1.2.1";
/** 1.2.0 adds the trade space, decision and custom maneuvers; it reproduces
 * 1.1.0 candidate results unchanged, so those archives remain importable. */
export const COMPATIBLE_MODEL_VERSIONS = [
  "aurora-analysis-1.1.0",
  "aurora-analysis-1.2.0",
  MODEL_VERSION,
];
/** Earliest replay offset: the earliest burn among standard and custom candidates. */
export const timelineLeadSeconds = (s: MissionScenario) =>
  Math.max(
    s.config.burnLeadSeconds,
    ...(s.customManeuvers ?? []).map((m) => m.burnLeadSeconds),
  );

function closestInStep(
  a: StateVector,
  b: StateVector,
  dt: number,
  model: "two-body" | "J2",
) {
  // Golden-section refinement of squared separation, including both endpoints.
  const evaluate = (t: number) => {
    const p = propagateState(a, t, 10, model),
      s = propagateState(b, t, 10, model);
    return { t, p, s, d: norm(sub(p.r, s.r)) };
  };
  let lo = 0,
    hi = dt;
  const ratio = (Math.sqrt(5) - 1) / 2;
  let x = hi - ratio * (hi - lo),
    y = lo + ratio * (hi - lo),
    fx = evaluate(x),
    fy = evaluate(y);
  for (let i = 0; i < 25; i++) {
    if (fx.d < fy.d) {
      hi = y;
      y = x;
      fy = fx;
      x = hi - ratio * (hi - lo);
      fx = evaluate(x);
    } else {
      lo = x;
      x = y;
      fx = fy;
      y = lo + ratio * (hi - lo);
      fy = evaluate(y);
    }
  }
  return [evaluate(0), evaluate(dt), fx, fy].sort((l, r) => l.d - r.d)[0];
}
export function simulateManeuver(
  scenario: MissionScenario,
  deltaVRtn: Vec3,
  id: string,
  label: string,
  leadSeconds = scenario.config.burnLeadSeconds,
  custom = false,
): ManeuverResult {
  const c = scenario.config;
  const dv = norm(deltaVRtn);
  if (dv > c.maxDeltaVMs + 1e-9)
    throw new Error("Candidate exceeds configured Δv budget");
  const start = -leadSeconds,
    end = c.encounterWindowSeconds;
  let primary = propagateState(
    scenario.primary.state,
    start,
    c.stepSeconds,
    c.forceModel,
  );
  const basis = rtnBasis(primary.r, primary.v);
  primary = {
    r: primary.r,
    v: add(
      primary.v,
      add(
        add(scale(basis[0], deltaVRtn[0]), scale(basis[1], deltaVRtn[1])),
        scale(basis[2], deltaVRtn[2]),
      ),
    ),
  };
  let secondary = propagateState(
    scenario.secondary.state,
    start,
    c.stepSeconds,
    c.forceModel,
  );
  const peers = scenario.screeningObjects.map((o) =>
    propagateState(o.state, start, c.stepSeconds, c.forceModel),
  );
  const screening = scenario.screeningObjects.map((o) => ({
    objectId: o.id,
    minimumDistanceM: Infinity,
    secondsFromEpoch: start,
    belowThreshold: false,
  }));
  let best = { t: start, p: primary, s: secondary, d: Infinity },
    displacement = 0;
  const samples: ManeuverResult["samples"] = [];
  const sampleStride = Math.max(
    1,
    Math.ceil((end - start) / c.stepSeconds / 360),
  );
  let index = 0;
  for (let t = start; t < end - 1e-8; index++) {
    // Land exactly on epoch and encounter-window start, as well as the end.
    const boundaries = [end, 0, -c.encounterWindowSeconds].filter(
      (x) => x > t + 1e-8,
    );
    const dt = Math.min(c.stepSeconds, ...boundaries.map((x) => x - t));
    const nextP = rk4(primary, dt, c.forceModel),
      nextS = rk4(secondary, dt, c.forceModel);
    if (t >= -c.encounterWindowSeconds - 1e-8) {
      const dr = sub(secondary.r, primary.r),
        dvrel = sub(secondary.v, primary.v);
      const nextDr = sub(nextS.r, nextP.r),
        nextDv = sub(nextS.v, nextP.v);
      // Only refine intervals with a turning point; still consider endpoints.
      const trial =
        dot(dr, dvrel) <= 0 && dot(nextDr, nextDv) >= 0
          ? closestInStep(primary, secondary, dt, c.forceModel)
          : norm(dr) < norm(nextDr)
            ? { t: 0, p: primary, s: secondary, d: norm(dr) }
            : { t: dt, p: nextP, s: nextS, d: norm(nextDr) };
      if (trial.d < best.d) best = { ...trial, t: t + trial.t };
    }
    peers.forEach((peer, i) => {
      const nextPeer = rk4(peer, dt, c.forceModel),
        dr = sub(peer.r, primary.r),
        v = sub(peer.v, primary.v);
      const nextDr = sub(nextPeer.r, nextP.r),
        nextV = sub(nextPeer.v, nextP.v);
      const trial =
        dot(dr, v) <= 0 && dot(nextDr, nextV) >= 0
          ? closestInStep(primary, peer, dt, c.forceModel)
          : norm(dr) < norm(nextDr)
            ? { t: 0, d: norm(dr) }
            : { t: dt, d: norm(nextDr) };
      if (trial.d < screening[i].minimumDistanceM) {
        screening[i].minimumDistanceM = trial.d;
        screening[i].secondsFromEpoch = t + trial.t;
      }
      peers[i] = nextPeer;
    });
    if (index % sampleStride === 0)
      samples.push({
        seconds: t,
        primary: primary.r,
        secondary: secondary.r,
        separationM: norm(sub(primary.r, secondary.r)),
      });
    t += dt;
    primary = nextP;
    secondary = nextS;
    if (Math.abs(t) < 1e-7)
      displacement = norm(sub(primary.r, scenario.primary.state.r));
  }
  samples.push({
    seconds: end,
    primary: primary.r,
    secondary: secondary.r,
    separationM: norm(sub(primary.r, secondary.r)),
  });
  screening.forEach(
    (s) => (s.belowThreshold = s.minimumDistanceM < c.screeningDistanceM),
  );
  return {
    id,
    label,
    deltaVRtn,
    deltaVMs: dv,
    burnLeadSeconds: leadSeconds,
    custom,
    fuelKg: c.massKg * (1 - Math.exp(-dv / (9.80665 * c.ispSeconds))),
    missDistanceM: best.d,
    tcaOffsetSeconds: best.t,
    relativeSpeedMs: norm(sub(best.p.v, best.s.v)),
    primaryAtTca: best.p,
    secondaryAtTca: best.s,
    displacementAtEpochM: displacement,
    screening,
    samples,
    boundaryMinimum:
      Math.abs(Math.abs(best.t) - c.encounterWindowSeconds) < 0.01,
  };
}
export function analyzeMission(scenario: MissionScenario): MissionAnalysis {
  const amount = scenario.config.maxDeltaVMs;
  const candidates = [
    ...simulateCandidates(scenario, amount),
    ...(scenario.customManeuvers ?? []).map((m) =>
      simulateManeuver(
        scenario,
        m.deltaVRtn,
        m.id,
        m.label,
        m.burnLeadSeconds,
        true,
      ),
    ),
  ];
  for (const candidate of candidates) {
    const risk = candidateProbability(scenario, candidate);
    candidate.computedPc = risk.pc;
    candidate.pcReason = risk.reason;
  }
  const encounter = assessEncounter(scenario.primary, scenario.secondary);
  let tradeSpace: TradeSpace | null = null,
    tradeSpaceError: string | null = null;
  try {
    tradeSpace = computeTradeSpace(scenario, encounter, candidates);
  } catch (e) {
    tradeSpaceError = e instanceof Error ? e.message : "Trade space failed";
  }
  const { action, goal } = pcThresholds(scenario);
  return {
    modelVersion: MODEL_VERSION,
    encounter,
    candidates,
    tradeSpace,
    tradeSpaceError,
    decision: decide(scenario, encounter, candidates, tradeSpace),
    assumptions: [
      `States: ${scenario.frame}; metres and m/s; epoch ${scenario.epoch}.`,
      "Baseline Pc: independent Gaussian position errors, constant covariance, circular combined hard-body radius, short rectilinear encounter. No cross-correlation.",
      `Candidate trajectories: RK4 ${scenario.config.forceModel}, step ≤ ${scenario.config.stepSeconds} s, instantaneous RTN impulse. No drag, solar pressure, third bodies or finite burns.`,
      "Candidate Pc requires both full 6D state covariances. Central finite-difference state transitions transport uncertainty; independent isotropic Gaussian burn error is added. Missing inputs yield unavailable Pc. Nonlinear uncertainty and cross-correlation are not modeled.",
      `Secondary screening covers ${scenario.screeningObjects.length} explicitly supplied objects from burn to epoch + ${scenario.config.encounterWindowSeconds} s; deterministic distance threshold, not catalog-wide clearance.`,
      "Fuel uses ideal rocket equation with configured mass and specific impulse. Displacement is a geometry metric, not a validated service-coverage impact.",
      "Covariance positive definiteness verifies mathematical validity, not observational realism.",
      `Trade space: burn lead 5–120 min × single-axis Δv within budget, linearized by forward-difference impulse sensitivities. Miss distances are compared against full RK4 candidates; this check does not validate map probabilities. It guides design; recommendations use full RK4 candidates only.`,
      `Decision: maneuver evaluated when baseline Pc exceeds ${action.toExponential(0)}; a candidate qualifies at Pc ≤ ${goal.toExponential(0)} with no screening flag or boundary minimum, ranked by Δv. A review aid, not command authorization.`,
    ],
  };
}
function simulateCandidates(
  s: MissionScenario,
  amount: number,
): ManeuverResult[] {
  const defs: { id: string; label: string; v: Vec3 }[] = [
    { id: "coast", label: "Coast · no burn", v: [0, 0, 0] },
  ];
  for (const fraction of [0.25, 0.5, 1])
    for (const sign of [-1, 1])
      defs.push({
        id: `along-${fraction}-${sign}`,
        label: `${sign > 0 ? "Prograde" : "Retrograde"} · ${(amount * fraction).toFixed(amount * fraction < 0.1 ? 4 : 2)} m/s`,
        v: [0, sign * amount * fraction, 0],
      });
  for (const axis of [0, 2])
    for (const sign of [-1, 1]) {
      const v: Vec3 = [0, 0, 0];
      v[axis] = amount;
      v[axis] *= sign;
      defs.push({
        id: `axis-${axis}-${sign}`,
        label: `${axis === 0 ? "Radial" : "Normal"} ${sign > 0 ? "+" : "−"}`,
        v,
      });
    }
  return defs.map((d) => simulateManeuver(s, d.v, d.id, d.label));
}
