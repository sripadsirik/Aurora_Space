export type OrbitType = "LEO" | "MEO" | "GEO";

export type RiskLevel = "nominal" | "watch" | "warning" | "critical";

export interface Satellite {
  noradId: number;
  name: string;
  lat: number;
  lon: number;
  altitudeKm: number;
  velocityKms: number;
  orbitType: OrbitType;
  riskLevel: RiskLevel;
  owner: string;
  conjunctionCount: number;
}

export interface SpaceWeather {
  kpIndex: number;
  solarWindSpeed: number;
  solarWindDensity: number;
  bzComponent: number;
  xrayFlux: string;
  stormLevel: "none" | "minor" | "moderate" | "strong" | "severe" | "extreme";
  auroraKp: number;
  lastUpdated: Date;
}

export interface ConjunctionObjectRef {
  noradId: number;
  name: string;
}

export interface ConjunctionWarning {
  id: string;
  object1: ConjunctionObjectRef;
  object2: ConjunctionObjectRef;
  tca: Date;
  missDistanceKm: number;
  missDistanceM: number;
  pc: number;
  probability: number;
  relativeVelocityKms: number;
  riskLevel: RiskLevel;
}

export type Conjunction = ConjunctionWarning;

export type VisualMode = "OPS" | "STORM" | "INTEL" | "HELIO";
export type SourceStatus = "LIVE" | "STALE" | "ERROR";

export interface SourceDiagnostic {
  key: string;
  name: string;
  url: string;
  status: SourceStatus;
  lastEvent: string;
  records: string;
  frequency: string;
  detail?: string;
}

export type CmeImpactStatus = "DIRECT HIT" | "GLANCING BLOW" | "NO IMPACT — MISS";

export interface MockCME {
  id: number;
  label: string;
  startTime: string;
  speed: number;
  arrivalTime: string;
  hoursUntilArrival: number;
  predictedKp: number;
  stormLevel: string;
  confidence: number;
  direction: string;
  impactStatus: CmeImpactStatus;
  azimuthFromEarth?: number;
  note?: string;
}

export interface HistoricalEvent {
  id: string;
  name: string;
  date: Date;
  description: string;
  type: "solar_storm" | "conjunction" | "satellite_loss";
  kpIndex?: number;
  solarWindSpeed?: number;
  bzComponent?: number;
  stormLevel?: SpaceWeather["stormLevel"];
}
