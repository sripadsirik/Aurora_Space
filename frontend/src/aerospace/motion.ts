import type { Aircraft } from "./data";
// Constant-speed great-circle estimate, bounded to 30 seconds. Observations
// remain unchanged and are used separately for the recorded trail.
export function estimatedPosition(
  a: Aircraft,
  now: number,
): { lat: number; lon: number; altitudeM: number } {
  const age = Math.max(0, Math.min(30, (now - a.observedAt) / 1000));
  if (a.speed === null || a.heading === null || a.speed < 0 || a.speed > 1500)
    return a;
  const rad = Math.PI / 180,
    lat = a.lat * rad,
    lon = a.lon * rad,
    bearing = a.heading * rad;
  const d = (a.speed * 0.514444 * age) / 6371000;
  const nextLat = Math.asin(
    Math.sin(lat) * Math.cos(d) +
      Math.cos(lat) * Math.sin(d) * Math.cos(bearing),
  );
  const nextLon =
    lon +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat),
      Math.cos(d) - Math.sin(lat) * Math.sin(nextLat),
    );
  return {
    lat: nextLat / rad,
    lon: ((nextLon / rad + 540) % 360) - 180,
    altitudeM: a.altitudeM,
  };
}
