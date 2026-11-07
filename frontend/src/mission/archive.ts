import { validateStateCovariance } from "./uncertainty";
import { norm, validateCovariance } from "./math";
import { EARTH_RADIUS } from "./dynamics";
import {
  COMPATIBLE_MODEL_VERSIONS,
  MODEL_VERSION,
  timelineLeadSeconds,
} from "./analysis";
import { pcThresholds } from "./tradeSpace";
import type { MissionAnalysis, MissionObject, MissionScenario } from "./types";
export interface MissionArchive {
  schema: "aurora-archive-v1";
  modelVersion: string;
  scenario: MissionScenario;
  notes: string;
  selectedCandidate: string;
  replaySeconds: number;
  capture: unknown;
  sha256: string;
}
export function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite archive number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object")
    return `{${Object.keys(value as object)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  throw new Error("Archive contains unsupported value");
}
export async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
const date = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 19) === v.slice(0, 19);
export function validateScenario(value: unknown): MissionScenario {
  if (!value || typeof value !== "object")
    throw new Error("Expected a mission scenario");
  const s = value as MissionScenario;
  if (
    s.schema !== "aurora-mission-v1" ||
    !["GCRF", "EME2000"].includes(s.frame) ||
    !["synthetic", "imported"].includes(s.kind)
  )
    throw new Error("Unsupported schema, frame or scenario kind");
  if (
    !date(s.epoch) ||
    typeof s.name !== "string" ||
    !s.name ||
    typeof s.id !== "string" ||
    typeof s.description !== "string"
  )
    throw new Error("Invalid scenario identity / UTC epoch");
  if (
    !s.source ||
    typeof s.source.name !== "string" ||
    typeof s.source.reference !== "string" ||
    !date(s.source.capturedAt)
  )
    throw new Error("Source provenance is required");
  const object = (o: MissionObject) => {
    if (
      !o ||
      typeof o.id !== "string" ||
      !o.id ||
      typeof o.name !== "string" ||
      !o.state ||
      ![o.state.r, o.state.v].every(
        (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite),
      )
    )
      throw new Error("Invalid object state");
    if (
      norm(o.state.r) <= EARTH_RADIUS ||
      norm(o.state.r) > 1e9 ||
      norm(o.state.v) > 1e5
    )
      throw new Error("State outside supported Earth-orbit bounds");
    if (!Number.isFinite(o.radiusM) || o.radiusM <= 0 || o.radiusM > 1000)
      throw new Error("Hard-body radius must be in (0, 1000] m");
    validateCovariance(o.covariance);
    if (o.stateCovariance) {
      validateStateCovariance(o.stateCovariance);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
          if (
            Math.abs(o.covariance[i][j] - o.stateCovariance[i][j]) >
            1e-8 * Math.max(1, Math.abs(o.covariance[i][j]))
          )
            throw new Error("Position and state covariance blocks disagree");
    }
  };
  if (!Array.isArray(s.screeningObjects) || s.screeningObjects.length > 30)
    throw new Error("Screening set limit: 30 objects");
  const objects = [s.primary, s.secondary, ...s.screeningObjects];
  objects.forEach(object);
  if (new Set(objects.map((o) => o.id)).size !== objects.length)
    throw new Error("Object identities must be unique");
  const c = s.config;
  if (!c || !["two-body", "J2"].includes(c.forceModel))
    throw new Error("Unsupported force model");
  if (
    c.burnExecutionSigmaMs !== null &&
    (!Number.isFinite(c.burnExecutionSigmaMs) ||
      c.burnExecutionSigmaMs < 0 ||
      c.burnExecutionSigmaMs > 1)
  )
    throw new Error("Burn execution sigma must be null or 0–1 m/s");
  const ranges: [number, number, number, string][] = [
    [c.stepSeconds, 1, 30, "Step"],
    [c.burnLeadSeconds, 60, 7200, "Burn lead"],
    [c.encounterWindowSeconds, 10, 600, "Encounter window"],
    [c.maxDeltaVMs, 0.01, 20, "Δv"],
    [c.screeningDistanceM, 1, 1e6, "Screening distance"],
    [c.massKg, 1, 1e6, "Mass"],
    [c.ispSeconds, 1, 1e5, "Specific impulse"],
  ];
  ranges.forEach(([v, min, max, name]) => {
    if (!Number.isFinite(v) || v < min || v > max)
      throw new Error(`${name} must be between ${min} and ${max}`);
  });
  if (c.burnLeadSeconds <= c.encounterWindowSeconds)
    throw new Error("Burn must precede encounter window");
  for (const [v, name] of [
    [c.pcActionThreshold, "Pc action threshold"],
    [c.pcGoal, "Pc goal"],
  ] as const)
    if (v !== undefined && (!Number.isFinite(v) || v <= 0 || v > 1))
      throw new Error(`${name} must be in (0, 1]`);
  const { action, goal } = pcThresholds(s);
  if (goal > action)
    throw new Error("Pc goal must not exceed the action threshold");
  if (s.customManeuvers !== undefined) {
    if (!Array.isArray(s.customManeuvers) || s.customManeuvers.length > 20)
      throw new Error("Custom maneuver limit: 20");
    const ids = new Set<string>();
    for (const m of s.customManeuvers) {
      if (
        !m ||
        typeof m.id !== "string" ||
        !/^custom-[\w-]{1,40}$/.test(m.id) ||
        ids.has(m.id) ||
        typeof m.label !== "string" ||
        !m.label ||
        m.label.length > 80
      )
        throw new Error("Custom maneuvers need unique custom-* ids and labels");
      ids.add(m.id);
      if (
        !Array.isArray(m.deltaVRtn) ||
        m.deltaVRtn.length !== 3 ||
        !m.deltaVRtn.every(Number.isFinite) ||
        norm(m.deltaVRtn) > c.maxDeltaVMs + 1e-9
      )
        throw new Error(`${m.label}: Δv must be finite and within budget`);
      if (
        !Number.isFinite(m.burnLeadSeconds) ||
        m.burnLeadSeconds <= c.encounterWindowSeconds ||
        m.burnLeadSeconds > 7200
      )
        throw new Error(
          `${m.label}: burn lead must follow the encounter window and be ≤ 7200 s`,
        );
    }
  }
  if (
    !Array.isArray(s.revisions) ||
    s.revisions.length > 1000 ||
    !s.revisions.every(
      (r) =>
        typeof r.id === "string" &&
        date(r.issuedAt) &&
        (r.missDistanceM === null ||
          (Number.isFinite(r.missDistanceM) && r.missDistanceM >= 0)) &&
        (r.suppliedPc === null ||
          (Number.isFinite(r.suppliedPc) &&
            r.suppliedPc >= 0 &&
            r.suppliedPc <= 1)),
    )
  )
    throw new Error("Invalid report history");
  return s;
}
export async function createArchive(
  scenario: MissionScenario,
  notes: string,
  selectedCandidate: string,
  replaySeconds: number,
  capture: unknown = null,
): Promise<MissionArchive> {
  validateScenario(scenario);
  const body = {
    schema: "aurora-archive-v1" as const,
    modelVersion: MODEL_VERSION,
    scenario,
    notes,
    selectedCandidate,
    replaySeconds,
    capture,
  };
  return { ...body, sha256: await digest(body) };
}
export async function readArchive(text: string): Promise<MissionArchive> {
  if (text.length > 30_000_000) throw new Error("Archive limit: 30 MB");
  const parsed = JSON.parse(text);
  if (parsed.schema === "aurora-mission-v1")
    return createArchive(
      validateScenario(parsed),
      "",
      "coast",
      -parsed.config.burnLeadSeconds,
    );
  const { sha256, ...body } = parsed;
  if (
    body.schema !== "aurora-archive-v1" ||
    typeof sha256 !== "string" ||
    (await digest(body)) !== sha256
  )
    throw new Error("Archive checksum mismatch or unsupported schema");
  if (!COMPATIBLE_MODEL_VERSIONS.includes(body.modelVersion))
    throw new Error(
      `Archive requires ${body.modelVersion}; current model is ${MODEL_VERSION}`,
    );
  validateScenario(body.scenario);
  if (
    typeof body.notes !== "string" ||
    typeof body.selectedCandidate !== "string" ||
    !Number.isFinite(body.replaySeconds) ||
    body.replaySeconds < -timelineLeadSeconds(body.scenario) ||
    body.replaySeconds > body.scenario.config.encounterWindowSeconds
  )
    throw new Error("Invalid analyst session");
  return parsed;
}
export function engineeringReport(
  s: MissionScenario,
  a: MissionAnalysis,
  notes: string,
): string {
  return [
    `# AURORA · Mission analysis`,
    s.name,
    `Scenario: ${s.kind.toUpperCase()} · ${s.id}`,
    `Epoch: ${s.epoch} · Frame: ${s.frame}`,
    `Source: ${s.source.name}`,
    s.source.reference,
    `Model: ${a.modelVersion}`,
    "",
    "## Baseline encounter",
    `Miss distance: ${a.encounter.missDistanceM.toFixed(3)} m`,
    `Relative speed: ${a.encounter.relativeSpeedMs.toFixed(3)} m/s`,
    `Computed 2D Pc: ${a.encounter.pc.toExponential(8)}`,
    `Combined hard-body radius: ${a.encounter.hardBodyRadiusM} m`,
    `Quadrature difference: ${a.encounter.integrationError.toExponential(3)}`,
    "",
    "## Maneuver trade study",
    "Candidate | Δv m/s | Ideal fuel kg | Miss m | TCA offset s | Displacement m | Screening threshold flags | Computed Pc",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...a.candidates.map(
      (c) =>
        `${c.label} | ${c.deltaVMs.toFixed(3)} | ${c.fuelKg.toFixed(6)} | ${c.missDistanceM.toFixed(3)} | ${c.tcaOffsetSeconds.toFixed(3)} | ${c.displacementAtEpochM.toFixed(3)} | ${c.screening.filter((x) => x.belowThreshold).length} | ${c.computedPc == null ? "Unavailable" : c.computedPc === 0 ? "< 1e-300 (numerical floor)" : c.computedPc.toExponential(8)}`,
    ),
    "",
    "## Decision",
    `Status: ${a.decision.status.toUpperCase()} · ${a.decision.headline}`,
    `Action threshold ${a.decision.pcActionThreshold.toExponential(1)} · goal ${a.decision.pcGoal.toExponential(1)}`,
    ...a.decision.rationale.map((x) => `- ${x}`),
    "",
    ...(a.tradeSpace
      ? [
          "## Trade space (linearized)",
          `Linear map agrees with ${a.tradeSpace.validation.candidates} full RK4 candidates within ${a.tradeSpace.validation.maxMissErrorM.toFixed(3)} m (${(a.tradeSpace.validation.maxRelativeError * 100).toFixed(4)}% relative).`,
          "Burn lead | Along-track min Δv m/s | Radial min Δv m/s | Normal min Δv m/s",
          "---: | ---: | ---: | ---:",
          ...a.tradeSpace.leadsSeconds.map(
            (lead, i) =>
              `T−${lead / 60} min | ${a
                .tradeSpace!.axes.map((x) => {
                  const v = x.minDeltaVForGoalMs[i];
                  return v === null ? "—" : v.toFixed(4);
                })
                .join(" | ")}`,
          ),
          "",
        ]
      : []),
    "## Model assumptions",
    ...a.assumptions.map((x) => `- ${x}`),
    "",
    "## Analyst notes",
    notes || "No notes recorded.",
    "",
    "Import the companion JSON archive to reproduce these results. This report contains simulation trade studies, not spacecraft command authorization.",
  ].join("\n");
}
