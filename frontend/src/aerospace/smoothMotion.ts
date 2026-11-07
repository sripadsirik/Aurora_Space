import { Cartesian3, Math as CesiumMath } from "cesium";
import type { Aircraft } from "./data";
import { estimatedPosition } from "./motion";

/** Smooth feed corrections without extending the existing 30-second estimate. */
export class AircraftMotion {
  private aircraft: Aircraft;
  private correction = new Cartesian3();
  private correctedAt = 0;
  private previousHeading: number;
  constructor(aircraft: Aircraft) {
    this.aircraft = aircraft;
    this.previousHeading = aircraft.heading ?? 0;
  }
  update(aircraft: Aircraft, now: number) {
    if (aircraft.observedAt <= this.aircraft.observedAt) return;
    const current = this.position(now);
    this.previousHeading = CesiumMath.toDegrees(this.heading(now));
    const next = estimatedPosition(aircraft, now);
    const target = Cartesian3.fromDegrees(
      next.lon,
      next.lat,
      Math.max(0, next.altitudeM),
    );
    this.aircraft = aircraft;
    this.correctedAt = now;
    // Large discontinuities are a new track, not a flight across the missing gap.
    this.correction =
      Cartesian3.distance(current, target) < 25000
        ? Cartesian3.subtract(current, target, new Cartesian3())
        : new Cartesian3();
  }
  private blend(now: number) {
    const t = Math.min(1, Math.max(0, (now - this.correctedAt) / 2000));
    return t * t * (3 - 2 * t);
  }
  position(now: number, result = new Cartesian3()) {
    const p = estimatedPosition(this.aircraft, now);
    Cartesian3.fromDegrees(
      p.lon,
      p.lat,
      Math.max(0, p.altitudeM),
      undefined,
      result,
    );
    const remaining = 1 - this.blend(now);
    result.x += this.correction.x * remaining;
    result.y += this.correction.y * remaining;
    result.z += this.correction.z * remaining;
    return result;
  }
  heading(now: number) {
    const target = this.aircraft.heading ?? this.previousHeading;
    const difference = ((target - this.previousHeading + 540) % 360) - 180;
    return CesiumMath.toRadians(
      this.previousHeading + difference * this.blend(now),
    );
  }
}
