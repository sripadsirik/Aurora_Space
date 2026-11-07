import { eciToEcf, gstime, propagate } from "satellite.js";
import { hasCurrentElements, orbitalElements } from "./orbitalElements";
import type { Satellite } from "../types/space";

export interface CatalogWindow {
  generation: number;
  startMs: number;
  endMs: number;
  positions: Float64Array;
  valid: number;
  total: number;
  computeMs: number;
}

/** Two Earth-fixed SGP4 samples per object; NaNs explicitly withhold invalid states. */
export function propagateCatalogWindow(satellites: Satellite[], startMs: number, generation = 0): CatalogWindow {
  const before = performance.now();
  const endMs = startMs + 2000;
  const times = [new Date(startMs), new Date(endMs)];
  const angles = times.map(gstime);
  const positions = new Float64Array(satellites.length * 6).fill(NaN);
  let valid = 0;
  satellites.forEach((satellite, index) => {
    if (!times.every(time => hasCurrentElements(satellite, time))) return;
    const record = orbitalElements(satellite);
    if (!record) return;
    try {
      for (let sample = 0; sample < 2; sample++) {
        const state = propagate(record, times[sample]);
        if (!state?.position || record.error !== 0) throw new Error("Propagation unavailable");
        const fixed = eciToEcf(state.position, angles[sample]);
        const values = [fixed.x * 1000, fixed.y * 1000, fixed.z * 1000];
        if (!values.every(Number.isFinite)) throw new Error("Invalid position");
        positions.set(values, index * 6 + sample * 3);
      }
      valid++;
    } catch { positions.fill(NaN, index * 6, index * 6 + 6); }
  });
  return { generation, startMs, endMs, positions, valid, total: satellites.length, computeMs: performance.now() - before };
}
