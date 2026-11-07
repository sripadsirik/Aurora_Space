import { pcThresholds } from "./tradeSpace";
import type {
  EncounterResult,
  ManeuverResult,
  MissionDecision,
  MissionScenario,
  TradeSpace,
} from "./types";

const pc = (p: number) => (p === 0 ? "< 1e−300" : p.toExponential(1));
const minutes = (s: number) => `T−${Math.round(s / 60)} min`;

/** Recommendation over full RK4 candidates only. The linearized trade space adds
 * context, never the recommendation itself. */
export function decide(
  s: MissionScenario,
  encounter: EncounterResult,
  candidates: ManeuverResult[],
  trade: TradeSpace | null,
): MissionDecision {
  const { action, goal } = pcThresholds(s);
  const base = {
    pcActionThreshold: action,
    pcGoal: goal,
  };
  const context: string[] = [];
  if (trade && encounter.pc > goal) {
    const transverse = trade.axes.find((a) => a.axis === "transverse")!;
    const rows = trade.leadsSeconds
      .map((lead, i) => ({ lead, dv: transverse.minDeltaVForGoalMs[i] }))
      .filter((r): r is { lead: number; dv: number } => r.dv !== null);
    if (rows.length) {
      const near = rows.reduce((a, b) =>
        Math.abs(b.lead - s.config.burnLeadSeconds) <
        Math.abs(a.lead - s.config.burnLeadSeconds)
          ? b
          : a,
      );
      const latest = rows[0];
      context.push(
        `Linear estimate: ${Math.abs(near.dv).toFixed(3)} m/s along-track at ${minutes(near.lead)}; latest qualifying grid time ${minutes(latest.lead)}. Verify a designed candidate with the full model.`,
      );
    }
  }
  if (encounter.pc <= action)
    return {
      ...base,
      status: "monitor",
      recommendedId: null,
      headline: "Monitor · no maneuver warranted",
      rationale: [
        `Baseline Pc ${pc(encounter.pc)} is at or below the ${pc(action)} action threshold.`,
        "Continue tracking and reassess when the next report arrives.",
        ...context,
      ],
    };
  const burns = candidates.filter((c) => c.deltaVMs > 0);
  const qualifying = burns
    .filter(
      (c) =>
        c.computedPc != null &&
        c.computedPc <= goal &&
        !c.boundaryMinimum &&
        c.screening.every((x) => !x.belowThreshold),
    )
    .sort(
      (a, b) =>
        a.deltaVMs - b.deltaVMs || (a.computedPc ?? 0) - (b.computedPc ?? 0),
    );
  const exceeds = `Baseline Pc ${pc(encounter.pc)} exceeds the ${pc(action)} action threshold.`;
  if (qualifying.length) {
    const r = qualifying[0];
    const screening = r.screening.length
      ? `all ${r.screening.length} screening objects clear`
      : "no screening objects supplied";
    return {
      ...base,
      status: "maneuver",
      recommendedId: r.id,
      // Designed candidates already carry their burn time in the label.
      headline: r.custom
        ? r.label
        : `${r.label} at ${minutes(r.burnLeadSeconds)}`,
      rationale: [
        exceeds,
        `Pc ${pc(encounter.pc)} → ${pc(r.computedPc!)} · miss ${r.missDistanceM >= 1000 ? `${(r.missDistanceM / 1000).toFixed(2)} km` : `${r.missDistanceM.toFixed(1)} m`} · ${(r.fuelKg * 1000).toFixed(1)} g propellant · ${screening}.`,
        `Lowest Δv of ${qualifying.length} full-RK4 candidate${qualifying.length > 1 ? "s" : ""} meeting the ${pc(goal)} goal.`,
        ...context,
      ],
    };
  }
  if (burns.some((c) => c.computedPc == null))
    return {
      ...base,
      status: "insufficient-data",
      recommendedId: null,
      headline: "Candidate Pc unavailable",
      rationale: [
        exceeds,
        burns.find((c) => c.computedPc == null)?.pcReason ??
          "Candidate probability unavailable.",
        "Supply full state covariances and a burn execution uncertainty to rank candidates by risk.",
        ...context,
      ],
    };
  return {
    ...base,
    status: "no-feasible",
    recommendedId: null,
    headline: "No candidate reaches the Pc goal",
    rationale: [
      exceeds,
      `None of ${burns.length} burns reaches ${pc(goal)} without a screening flag or boundary minimum.`,
      "Burn earlier, raise the Δv budget, or design a maneuver from the trade space.",
      ...context,
    ],
  };
}
