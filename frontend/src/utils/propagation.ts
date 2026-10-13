import { Cartesian3 } from "cesium";
import { eciToEcf, eciToGeodetic, gstime, propagate, twoline2satrec, type SatRec } from "satellite.js";
import type { Satellite } from "../types/space";

const records = new Map<number, { key: string; record: SatRec | null }>();
const MAX_ELEMENT_AGE_DAYS = 14;

export function orbitalElements(satellite: Satellite): SatRec | null {
  const { tleLine1: line1, tleLine2: line2 } = satellite;
  if (!line1 || !line2) return null;
  const key = `${line1}\n${line2}`;
  const cached = records.get(satellite.noradId);
  if (cached?.key === key) return cached.record;
  let record: SatRec | null = null;
  try {
    if (line1.length >= 69 && line2.length >= 69 && line1.startsWith("1 ") && line2.startsWith("2 ") && line1.slice(2, 7) === line2.slice(2, 7)) {
      const parsed = twoline2satrec(line1, line2);
      if (parsed.error === 0 && Number.isFinite(parsed.jdsatepoch) && parsed.no > 0 && parsed.ecco >= 0 && parsed.ecco < 1) record = parsed;
    }
  } catch { /* Invalid element sets have no predicted path. */ }
  if (records.size > 30000) records.clear();
  records.set(satellite.noradId, { key, record });
  return record;
}

export function elementEpoch(satellite: Satellite): Date | null {
  const record = orbitalElements(satellite);
  return record ? new Date((record.jdsatepoch - 2440587.5) * 86400000) : null;
}

export function hasCurrentElements(satellite: Satellite, date = new Date()): boolean {
  const epoch = elementEpoch(satellite);
  return !!epoch && Math.abs(date.getTime() - epoch.getTime()) <= MAX_ELEMENT_AGE_DAYS * 86400000;
}

/** SGP4 TEME position, rotated into Earth-fixed coordinates at the sample time. */
export function propagatedPosition(satellite: Satellite, date = new Date(), result = new Cartesian3()): Cartesian3 | null {
  const record = orbitalElements(satellite);
  if (!record || !hasCurrentElements(satellite, date)) return null;
  try {
    const state = propagate(record, date);
    if (!state?.position || record.error !== 0) return null;
    const fixed = eciToEcf(state.position, gstime(date));
    if (![fixed.x, fixed.y, fixed.z].every(Number.isFinite)) return null;
    return Cartesian3.fromElements(fixed.x * 1000, fixed.y * 1000, fixed.z * 1000, result);
  } catch { return null; }
}

/** Open Earth-fixed trajectory: Earth rotates during one revolution, so it is not a closed ring. */
export function predictedOrbit(satellite: Satellite, start = new Date(), segments = 180): Cartesian3[] {
  const record = orbitalElements(satellite);
  if (!record || !hasCurrentElements(satellite, start)) return [];
  const periodMs = 2 * Math.PI / record.no * 60000;
  const positions: Cartesian3[] = [];
  for (let i = 0; i <= segments; i++) {
    const position = propagatedPosition(satellite, new Date(start.getTime() + periodMs * (i / segments - 0.25)));
    if (!position) return [];
    positions.push(position);
  }
  return positions;
}

export function propagatedTelemetry(satellite: Satellite, date = new Date()) {
  const record = orbitalElements(satellite);
  if (!record || !hasCurrentElements(satellite, date)) return null;
  try {
    const state = propagate(record, date);
    if (!state?.position || !state.velocity || record.error !== 0) return null;
    const geo = eciToGeodetic(state.position, gstime(date));
    return { altitudeKm: geo.height, lat: geo.latitude * 180 / Math.PI,
      lon: geo.longitude * 180 / Math.PI,
      velocityKms: Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z),
      periodMinutes: 2 * Math.PI / record.no, inclinationDegrees: record.inclo * 180 / Math.PI };
  } catch { return null; }
}
