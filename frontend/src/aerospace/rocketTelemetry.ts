import { Cartesian3 } from "cesium";
export interface RocketPosition {
  vehicleId: string;
  observedAt: number;
  lat: number;
  lon: number;
  altitudeM: number;
  heading: number;
  tilt: number;
  phase: string;
}
export interface RocketTelemetry {
  missionId: string;
  source: string;
  positions: RocketPosition[];
}
const number = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
/** Only explicit, recent mission-matched positions drive the live layer. */
export function parseRocketTelemetry(
  data: any,
  missionId: string,
  now: number,
): RocketTelemetry {
  if (
    data?.positionType !== "observed" ||
    data?.missionId !== missionId ||
    typeof data.source !== "string" ||
    !data.source.trim() ||
    !Array.isArray(data.positions)
  )
    throw Error("Unverified or mismatched rocket telemetry");
  const vehicles = new Set<string>();
  const positions: RocketPosition[] = data.positions
    .slice(0, 2000)
    .flatMap((p: any) => {
      const time = Date.parse(p.observedAt);
      if (
        typeof p.vehicleId !== "string" ||
        !p.vehicleId ||
        p.vehicleId.length > 80 ||
        !number(p.latitude) ||
        Math.abs(p.latitude) > 90 ||
        !number(p.longitude) ||
        Math.abs(p.longitude) > 180 ||
        !number(p.altitudeM) ||
        p.altitudeM < 0 ||
        p.altitudeM > 1e8 ||
        !Number.isFinite(time) ||
        now - time > 90000 ||
        time - now > 5000
      )
        return [];
      if (!vehicles.has(p.vehicleId) && vehicles.size >= 16) return [];
      vehicles.add(p.vehicleId);
      return [
        {
          vehicleId: p.vehicleId,
          observedAt: time,
          lat: p.latitude,
          lon: p.longitude,
          altitudeM: p.altitudeM,
          heading: number(p.headingDeg) ? p.headingDeg : 0,
          tilt: number(p.tiltDeg) ? Math.max(0, Math.min(180, p.tiltDeg)) : 0,
          phase:
            typeof p.phase === "string" ? p.phase.slice(0, 40) : "Unspecified",
        },
      ];
    });
  return {
    missionId,
    source: data.source.trim().slice(0, 160),
    positions: positions.sort((a, b) => a.observedAt - b.observedAt),
  };
}
/** One second of display delay interpolates observed samples without extrapolation. */
export function rocketPositionAt(
  samples: RocketPosition[],
  now: number,
  result = new Cartesian3(),
): Cartesian3 | undefined {
  if (!samples.length) return;
  const target = now - 1000;
  let left = samples[0],
    right = left;
  for (const sample of samples) {
    right = sample;
    if (sample.observedAt >= target) break;
    left = sample;
  }
  if (right.observedAt < target || right.observedAt <= left.observedAt)
    return Cartesian3.fromDegrees(
      right.lon,
      right.lat,
      right.altitudeM,
      undefined,
      result,
    );
  const a = Cartesian3.fromDegrees(left.lon, left.lat, left.altitudeM),
    b = Cartesian3.fromDegrees(right.lon, right.lat, right.altitudeM);
  return Cartesian3.lerp(
    a,
    b,
    Math.max(
      0,
      Math.min(
        1,
        (target - left.observedAt) / (right.observedAt - left.observedAt),
      ),
    ),
    result,
  );
}
