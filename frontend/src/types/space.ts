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
  missDistanceM: number;
  probability: number;
  relativeVelocityKms: number;
}

export type Conjunction = ConjunctionWarning;
