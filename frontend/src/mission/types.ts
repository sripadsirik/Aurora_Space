/** Mission analysis uses SI units, UTC, and a declared common inertial frame. */
export type Vec3 = [number, number, number];
export type Mat3 = [Vec3, Vec3, Vec3];
export interface StateVector {
  r: Vec3;
  v: Vec3;
}
export interface MissionObject {
  id: string;
  name: string;
  state: StateVector;
  /** Position covariance at the scenario epoch, in the declared inertial frame, m². */
  covariance: Mat3;
  /** Optional full inertial [r,v] covariance: m², m²/s, m²/s² blocks. */
  stateCovariance?: number[][];
  radiusM: number;
}
export interface ReportRevision {
  id: string;
  issuedAt: string;
  missDistanceM: number | null;
  suppliedPc: number | null;
}
export interface MissionScenario {
  schema: "aurora-mission-v1";
  id: string;
  name: string;
  description: string;
  kind: "synthetic" | "imported";
  epoch: string;
  frame: "GCRF" | "EME2000";
  primary: MissionObject;
  secondary: MissionObject;
  /** Explicit finite screening set; never interpreted as a complete catalog. */
  screeningObjects: MissionObject[];
  source: { name: string; reference: string; capturedAt: string; raw?: string };
  revisions: ReportRevision[];
  config: {
    stepSeconds: number;
    burnLeadSeconds: number;
    encounterWindowSeconds: number;
    maxDeltaVMs: number;
    screeningDistanceM: number;
    massKg: number;
    ispSeconds: number;
    forceModel: "two-body" | "J2";
    burnExecutionSigmaMs: number | null;
    /** Baseline Pc above which a maneuver is evaluated. Default 1e-4. */
    pcActionThreshold?: number;
    /** Post-maneuver Pc a candidate must reach to qualify. Default 1e-6. */
    pcGoal?: number;
  };
  /** Analyst-designed impulses, simulated with the same full RK4 model. */
  customManeuvers?: CustomManeuver[];
}
export interface CustomManeuver {
  id: string;
  label: string;
  deltaVRtn: Vec3;
  burnLeadSeconds: number;
}
export interface EncounterResult {
  missDistanceM: number;
  relativeSpeedMs: number;
  timeOffsetSeconds: number;
  mean: [number, number];
  covariance: [[number, number], [number, number]];
  ellipse: { major: number; minor: number; angle: number };
  pc: number;
  integrationError: number;
  hardBodyRadiusM: number;
}
export interface TrajectorySample {
  seconds: number;
  primary: Vec3;
  secondary: Vec3;
  separationM: number;
}
export interface ManeuverResult {
  id: string;
  label: string;
  deltaVRtn: Vec3;
  deltaVMs: number;
  burnLeadSeconds: number;
  custom: boolean;
  fuelKg: number;
  missDistanceM: number;
  tcaOffsetSeconds: number;
  relativeSpeedMs: number;
  primaryAtTca: StateVector;
  secondaryAtTca: StateVector;
  displacementAtEpochM: number;
  screening: {
    objectId: string;
    minimumDistanceM: number;
    secondsFromEpoch: number;
    belowThreshold: boolean;
  }[];
  samples: TrajectorySample[];
  boundaryMinimum: boolean;
  computedPc?: number | null;
  pcReason?: string;
}
export interface MissionAnalysis {
  modelVersion: string;
  encounter: EncounterResult;
  candidates: ManeuverResult[];
  tradeSpace: TradeSpace | null;
  tradeSpaceError: string | null;
  decision: MissionDecision;
  assumptions: string[];
}
export type TradeAxis = "transverse" | "radial" | "normal";
/** Linearized sweep of burn lead × signed single-axis Δv. Rows are leads. */
export interface TradeSpace {
  leadsSeconds: number[];
  deltaVMs: number[];
  axes: {
    axis: TradeAxis;
    missM: number[][];
    /** Null when burn execution uncertainty is unspecified. */
    pc: number[][] | null;
    /** Smallest signed Δv per lead reaching the Pc goal; null if none in budget. */
    minDeltaVForGoalMs: (number | null)[];
  }[];
  pcGoal: number;
  pcReason: string;
  /** Agreement of the linear map with every full RK4 candidate. */
  validation: {
    candidates: number;
    maxMissErrorM: number;
    maxRelativeError: number;
  };
}
export interface MissionDecision {
  status: "monitor" | "maneuver" | "no-feasible" | "insufficient-data";
  recommendedId: string | null;
  headline: string;
  rationale: string[];
  pcActionThreshold: number;
  pcGoal: number;
}
