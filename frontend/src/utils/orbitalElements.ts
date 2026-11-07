import { parseOMM } from "./omm";
import { twoline2satrec, type SatRec } from "satellite.js";
import type { Satellite } from "../types/space";

const records = new Map<number, { key: string; record: SatRec | null }>();
const MAX_ELEMENT_AGE_DAYS = 14;

export function orbitalElements(satellite: Satellite): SatRec | null {
  const { tleLine1: line1, tleLine2: line2 } = satellite;
  if (!satellite.omm && (!line1 || !line2)) return null;
  const key = satellite.omm ? JSON.stringify(satellite.omm) : `${line1}\n${line2}`;
  const cached = records.get(satellite.noradId);
  if (cached?.key === key) return cached.record;
  let record: SatRec | null = null;
  try {
    if (satellite.omm) { record = parseOMM(satellite.omm, satellite.noradId).record; }
    else if (line1 && line2 && line1.length >= 69 && line2.length >= 69 && line1.startsWith("1 ") && line2.startsWith("2 ") && line1.slice(2, 7) === line2.slice(2, 7) && Number(line1.slice(2, 7)) === satellite.noradId) {
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
  return !satellite.decayDate && !!epoch && date.getTime() - epoch.getTime() >= -86400000 && date.getTime() - epoch.getTime() <= MAX_ELEMENT_AGE_DAYS * 86400000;
}
