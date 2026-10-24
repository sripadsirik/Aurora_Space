import type { Conjunction } from "../types/space";

export interface ReviewObject { id: string; name: string; fields: Record<string, string> }
export interface ReviewReport {
  id: string; createdAt: string; tca: string; source: string;
  objects: [ReviewObject, ReviewObject]; pc: number | null; missDistanceM: number | null;
  relativeSpeedMs: number | null; method: string; fields: Record<string, string>;
  imported: boolean; raw?: string;
}
const numeric = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (String(value).trim() === "") return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
};
export const utcDate = (value: string): string => {
  if (typeof value !== "string") throw new Error("Missing UTC timestamp");
  const stamp = value.trim().replace(" ", "T");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(stamp)) throw new Error(`Invalid UTC timestamp: ${value}`);
  const d = new Date(/[Zz]|[+-]\d{2}:\d{2}$/.test(stamp) ? stamp : `${stamp}Z`);
  if (!Number.isFinite(d.getTime())) throw new Error(`Invalid UTC timestamp: ${value}`);
  return d.toISOString();
};
const metric = (value: string | undefined, unit: "m" | "m/s"): number | null => {
  if (!value) return null;
  const parts = value.match(/^\s*([+-]?[\d.]+(?:[eE][+-]?\d+)?)\s*(?:\[([^\]]+)\])?\s*$/);
  if (!parts) throw new Error(`Invalid ${unit} measurement: ${value}`);
  if (parts[2] && parts[2] !== unit) throw new Error(`Expected [${unit}], received [${parts[2]}]. Convert units before import.`);
  const n = numeric(parts[1]); if (n === null || n < 0) throw new Error(`Invalid ${unit} measurement: ${value}`);
  return n;
};
const probability = (value: unknown): number | null => {
  const p = numeric(value);
  if (p === null && value !== undefined && value !== null && value !== "") throw new Error("Invalid collision probability");
  if (p !== null && (p < 0 || p > 1)) throw new Error("Collision probability must be between 0 and 1");
  return p;
};

/** Supported import: one CCSDS CDM KVN document, or Aurora review JSON export. */
export function parseReviewImport(text: string, filename: string): ReviewReport[] {
  if (text.length > 2_000_000) throw new Error("Import limit: 2 MB per file");
  if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
    const json = JSON.parse(text);
    const rows = Array.isArray(json) ? json : json.reports;
    if (!Array.isArray(rows) || rows.length > 1000) throw new Error("Expected an Aurora review export containing up to 1,000 reports");
    return rows.map((r: ReviewReport) => {
      const stringFields = (f: unknown) => !!f && typeof f === "object" && !Array.isArray(f) && Object.values(f).every(v => typeof v === "string");
      if (!r || typeof r.id !== "string" || !Array.isArray(r.objects) || r.objects.length !== 2 ||
        !r.objects.every(o => o && typeof o.id === "string" && typeof o.name === "string" && stringFields(o.fields))) throw new Error("Invalid review report identity");
      if (!r.id.trim() || r.objects.some(o=>!o.id.trim()) || r.objects[0].id === r.objects[1].id || !stringFields(r.fields ?? {}) || typeof r.method !== "string") throw new Error("Invalid review report fields");
      const miss = numeric(r.missDistanceM), speed = numeric(r.relativeSpeedMs);
      if ((r.missDistanceM != null && miss === null) || (r.relativeSpeedMs != null && speed === null) || (miss !== null && miss < 0) || (speed !== null && speed < 0)) throw new Error("Invalid distance or speed");
      return { ...r, createdAt: utcDate(r.createdAt), tca: utcDate(r.tca), pc: probability(r.pc), missDistanceM: miss,
        relativeSpeedMs: speed, imported: true, source: typeof r.source === "string" && r.source ? r.source : `Local import · ${filename}`, fields: r.fields ?? {} };
    });
  }
  const fields: Record<string,string> = {};
  const objects: [Record<string,string>,Record<string,string>] = [{},{}];
  let section = -1;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("COMMENT")) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) throw new Error(`Unsupported KVN line: ${trimmed.slice(0, 60)}`);
    const [, key, value] = match;
    if (key === "OBJECT") {
      section = value === "OBJECT1" ? 0 : value === "OBJECT2" ? 1 : -1;
      if (section < 0) throw new Error("Expected OBJECT1 or OBJECT2");
    }
    const target = section < 0 ? fields : objects[section];
    if (key in target) throw new Error(`Duplicate field: ${key}`);
    target[key] = value;
  }
  if (!fields.CCSDS_CDM_VERS || !fields.TCA || !fields.CREATION_DATE || !fields.MESSAGE_ID) throw new Error("Missing CDM version, MESSAGE_ID, CREATION_DATE or TCA");
  if (fields.TIME_SYSTEM && fields.TIME_SYSTEM !== "UTC") throw new Error("Only UTC CDM timestamps are supported");
  for (const o of objects) if (!o.OBJECT_DESIGNATOR || !o.OBJECT_NAME) throw new Error("Both objects require OBJECT_DESIGNATOR and OBJECT_NAME");
  if (objects[0].OBJECT_DESIGNATOR === objects[1].OBJECT_DESIGNATOR) throw new Error("A conjunction requires two distinct objects");
  return [{ id: fields.MESSAGE_ID, createdAt: utcDate(fields.CREATION_DATE), tca: utcDate(fields.TCA), source: `Local import · ${filename}`,
    objects: objects.map(o => ({id:o.OBJECT_DESIGNATOR,name:o.OBJECT_NAME,fields:o})) as [ReviewObject, ReviewObject],
    pc: probability(fields.COLLISION_PROBABILITY), missDistanceM: metric(fields.MISS_DISTANCE, "m"),
    relativeSpeedMs: metric(fields.RELATIVE_SPEED, "m/s"), method: fields.COLLISION_PROBABILITY_METHOD ?? "Not supplied",
    fields, imported:true, raw:text }];
}

export function feedReview(event: Conjunction): ReviewReport {
  return { id:event.id, createdAt:event.createdAt ?? "", tca:event.tca.toISOString(),source:event.source ?? "Sample report",
    objects:[{id:String(event.object1.noradId),name:event.object1.name,fields:{}},{id:String(event.object2.noradId),name:event.object2.name,fields:{}}],
    pc:event.probability, missDistanceM:event.missDistanceM, relativeSpeedMs:null, method:"Not supplied",fields:{},imported:false };
}

export function sameEncounter(a: ReviewReport, b: ReviewReport): boolean {
  // A review aid, not a definitive provider event identity: report IDs remain distinct.
  const pair = (r: ReviewReport) => r.objects.map(o=>o.id).sort().join("/");
  return pair(a) === pair(b) && Math.abs(Date.parse(a.tca)-Date.parse(b.tca)) < 30*60000;
}
export function mergeReviewReports(current: ReviewReport[], incoming: ReviewReport[]): ReviewReport[] {
  const reports = new Map(current.map(r=>[`${r.source}/${r.id}`,r]));
  for (const report of incoming) {
    const key = `${report.source}/${report.id}`;
    const old = reports.get(key);
    if (old && JSON.stringify(old) !== JSON.stringify(report)) throw new Error(`Conflicting report ID ${report.id}; clear imports before replacing it`);
    reports.set(key,report);
  }
  if (reports.size > 1000) throw new Error("Review limit: 1,000 imported reports");
  return [...reports.values()];
}
export function reviewCompleteness(report: ReviewReport) {
  const state = ["X","Y","Z","X_DOT","Y_DOT","Z_DOT"];
  const covariance = ["CR_R","CT_R","CT_T","CN_R","CN_T","CN_N"];
  const present = (fields:Record<string,string>, key:string) => numeric(fields[key]?.split(/\s*\[/)[0]) !== null;
  return { states:report.objects.map(o=>state.every(k=>present(o.fields,k))),
    positionCovariances:report.objects.map(o=>covariance.every(k=>present(o.fields,k))) };
}

/** Only typed annotations belonging to an imported report are restored. */
export function reviewAnnotations(text: string, reports: ReviewReport[]) {
  const notes: Record<string,string> = {}, reviewed: Record<string,boolean> = {};
  if (!text.trim().startsWith("{")) return {notes, reviewed};
  const json = JSON.parse(text);
  for (const report of reports) {
    const key = `${report.source}/${report.id}`;
    if (typeof json.notes?.[key] === "string") notes[key] = json.notes[key];
    if (typeof json.reviewed?.[key] === "boolean") reviewed[key] = json.reviewed[key];
  }
  return {notes, reviewed};
}
