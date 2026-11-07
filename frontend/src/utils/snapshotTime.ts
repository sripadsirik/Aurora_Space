import type { Satellite } from "../types/space";
/** Re-delivering a cached snapshot must never refresh its observation epoch. */
export function satelliteSnapshotTime(rows: Satellite[]): Date {
  if (!rows.length) return new Date(NaN);
  let oldest = Infinity;
  for (const row of rows) {
    const epoch = Date.parse(row.positionTimestamp ?? "");
    if (!Number.isFinite(epoch)) return new Date(NaN);
    oldest = Math.min(oldest, epoch);
  }
  return new Date(oldest);
}
