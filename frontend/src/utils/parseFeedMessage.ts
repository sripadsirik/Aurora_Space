import type { Conjunction, Satellite, SpaceWeather } from "../types/space";

export type ParsedFeedMessage =
  | { type: "satellites"; payload: Satellite[] }
  | { type: "conjunctions"; payload: Conjunction[] }
  | { type: "spaceWeather"; payload: SpaceWeather };

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const string = (value: unknown): value is string => typeof value === "string";
const date = (value: unknown): Date | null => {
  if (!string(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};
const risk = (value: unknown): boolean =>
  value === "nominal" || value === "watch" || value === "warning" || value === "critical";

const satellite = (value: unknown): value is Satellite =>
  record(value) &&
  number(value.noradId) && string(value.name) &&
  number(value.lat) && number(value.lon) &&
  number(value.altitudeKm) && number(value.velocityKms) &&
  (value.orbitType === "LEO" || value.orbitType === "MEO" || value.orbitType === "GEO") &&
  risk(value.riskLevel) && string(value.owner) && number(value.conjunctionCount);

const objectRef = (value: unknown): boolean =>
  record(value) && number(value.noradId) && string(value.name);

const conjunction = (value: unknown): value is Record<string, unknown> =>
  record(value) && string(value.id) && objectRef(value.object1) && objectRef(value.object2) &&
  date(value.tca) !== null && number(value.missDistanceKm) && number(value.missDistanceM) &&
  number(value.pc) && number(value.probability) && number(value.relativeVelocityKms) && risk(value.riskLevel);

const weather = (value: unknown): value is Record<string, unknown> =>
  record(value) && number(value.kpIndex) && number(value.solarWindSpeed) &&
  number(value.solarWindDensity) && number(value.bzComponent) && string(value.xrayFlux) &&
  (value.protonFlux === undefined || number(value.protonFlux)) &&
  (value.stormLevel === "none" || value.stormLevel === "minor" || value.stormLevel === "moderate" ||
    value.stormLevel === "strong" || value.stormLevel === "severe" || value.stormLevel === "extreme") &&
  number(value.auroraKp) && date(value.lastUpdated) !== null;

/** Reject malformed feed messages before they can replace displayed data or reset freshness. */
export const parseFeedMessage = (value: unknown): ParsedFeedMessage | null => {
  if (!record(value)) return null;
  if (value.type === "satellites") {
    return Array.isArray(value.payload) && value.payload.every(satellite)
      ? { type: "satellites", payload: value.payload }
      : null;
  }
  if (value.type === "conjunctions") {
    return Array.isArray(value.payload) && value.payload.every(conjunction)
      ? {
          type: "conjunctions",
          payload: value.payload.map((item) => ({ ...item, tca: date(item.tca)! })) as Conjunction[]
        }
      : null;
  }
  if (value.type === "spaceWeather") {
    return weather(value.payload)
      ? { type: "spaceWeather", payload: { ...value.payload, lastUpdated: date(value.payload.lastUpdated)! } as unknown as SpaceWeather }
      : null;
  }
  return null;
};
