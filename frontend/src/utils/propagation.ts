import { orbitalElements, elementEpoch, hasCurrentElements } from "./orbitalElements";
export { orbitalElements, elementEpoch, hasCurrentElements } from "./orbitalElements";
import { Cartesian3 } from "cesium";
import { eciToEcf, eciToGeodetic, gstime, propagate } from "satellite.js";
import type { Satellite } from "../types/space";

/** Element age is independent of how recently a propagated position arrived. */
export function orbitalElementStatus(satellite: Satellite, date = new Date()): string {
  const format = satellite.omm ? "OMM" : "TLE";
  if (satellite.decayDate) return `Catalog reports decay ${satellite.decayDate} · position withheld`;
  const epoch = elementEpoch(satellite);
  if (!epoch) return `No valid ${format} · path unavailable`;
  const days = (date.getTime() - epoch.getTime()) / 86400000;
  if (days < -1) return `Future ${format} epoch · position withheld`;
  if (!hasCurrentElements(satellite, date)) return `Expired ${format} · ${Math.abs(days).toFixed(1)}d from epoch · path hidden`;
  return `${days > 3 ? `Aged ${format}` : `${format} age`} · ${Math.max(0, days).toFixed(1)}d · SGP4 prediction`;
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

/** One SGP4 revolution. Orbital returns TEME metres; the renderer rotates the whole path at view time. Earth-fixed rotates each sample at its own timestamp. Neither path is forcibly closed. */
export function predictedOrbit(satellite: Satellite, start = new Date(), segments = 180, frame: "earth-fixed" | "orbital" = "earth-fixed"): Cartesian3[] {
  const record = orbitalElements(satellite);
  if (!record || !hasCurrentElements(satellite, start)) return [];
  const periodMs = 2 * Math.PI / record.no * 60000;
  const positions: Cartesian3[] = [];
  for (let i = 0; i <= segments; i++) {
    const sampleTime = new Date(start.getTime() + periodMs * (i / segments - 0.25));
    let position: Cartesian3 | null = null;
    if (frame === "earth-fixed") position = propagatedPosition(satellite, sampleTime);
    else if (hasCurrentElements(satellite, sampleTime)) {
      try { const state = propagate(record, sampleTime); if (state?.position && !record.error) position = new Cartesian3(state.position.x * 1000, state.position.y * 1000, state.position.z * 1000); } catch { /* withheld */ }
    }
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

/** Display classification using orbital period, not instantaneous altitude. */
export function orbitDescription(satellite: Satellite): string {
 const record=orbitalElements(satellite);
 if (!record) return `${satellite.orbitType} · snapshot altitude class`;
 const period=2*Math.PI/record.no;
 if (Math.abs(period-1436.068)<15) return record.inclo*180/Math.PI>1 ? "Near-geosynchronous · inclined" : "Near-geosynchronous · near-equatorial";
 if (record.ecco>0.25) return "Highly elliptical Earth orbit";
 return `${satellite.orbitType} · altitude class`;
}
