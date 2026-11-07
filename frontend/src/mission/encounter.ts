import {
  add,
  cross,
  dot,
  norm,
  quad,
  scale,
  sub,
  sumMatrix,
  unit,
  validateCovariance,
} from "./math";
import type { EncounterResult, MissionObject, Vec3 } from "./types";

/** Composite Simpson integration over a hard-body disk. Gaussian density is evaluated in
 * polar coordinates. Doubling both grid dimensions supplies a convergence diagnostic. */
export function diskProbability(
  mean: [number, number],
  covariance: [[number, number], [number, number]],
  radius: number,
  resolution = 64,
): number {
  const [a, b] = covariance[0],
    [b2, d] = covariance[1];
  const determinant = a * d - b * b;
  if (
    ![...mean, a, b, b2, d, radius].every(Number.isFinite) ||
    radius <= 0 ||
    a <= 0 ||
    d <= 0 ||
    determinant <= 0 ||
    Math.abs(b - b2) > 1e-8 * Math.max(a, d)
  )
    throw new Error("Invalid encounter-plane covariance or radius");
  if (
    !Number.isInteger(resolution) ||
    resolution < 8 ||
    resolution > 1024 ||
    resolution % 2
  )
    throw new Error(
      "Integration resolution must be an even integer between 8 and 1024",
    );
  const n = resolution,
    dr = radius / n,
    dt = (2 * Math.PI) / n;
  let total = 0;
  for (let i = 0; i <= n; i++) {
    const r = i * dr,
      wr = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    let angular = 0;
    for (let j = 0; j <= n; j++) {
      const t = j * dt,
        x = r * Math.cos(t) - mean[0],
        y = r * Math.sin(t) - mean[1];
      const exponent =
        -(d * x * x - 2 * b * x * y + a * y * y) / (2 * determinant);
      angular += (j === 0 || j === n ? 1 : j % 2 ? 4 : 2) * Math.exp(exponent);
    }
    total += wr * r * angular;
  }
  return Math.min(
    1,
    Math.max(0, (total * dr * dt) / (9 * 2 * Math.PI * Math.sqrt(determinant))),
  );
}
/** Orthonormal axes of the plane perpendicular to relative velocity. */
export function encounterPlane(relativeVelocity: Vec3): [Vec3, Vec3] {
  const normal = unit(relativeVelocity);
  const reference: Vec3 = Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const axisX = unit(cross(normal, reference));
  return [axisX, cross(normal, axisX)];
}
export function assessEncounter(
  primary: MissionObject,
  secondary: MissionObject,
): EncounterResult {
  validateCovariance(primary.covariance);
  validateCovariance(secondary.covariance);
  const relative = sub(secondary.state.r, primary.state.r),
    velocity = sub(secondary.state.v, primary.state.v);
  const speed = norm(velocity);
  if (speed < 10)
    throw new Error(
      "Relative speed below 10 m/s: short-encounter 2D Pc is unsupported",
    );
  const [axisX, axisY] = encounterPlane(velocity);
  const time = -dot(relative, velocity) / (speed * speed);
  if (Math.abs(time) > 30)
    throw new Error(
      "State epoch must be within 30 seconds of linearized closest approach",
    );
  const miss = add(relative, scale(velocity, time));
  const combined = sumMatrix(primary.covariance, secondary.covariance);
  const a = quad(axisX, combined, axisX),
    b = quad(axisX, combined, axisY),
    d = quad(axisY, combined, axisY);
  const covariance: [[number, number], [number, number]] = [
    [a, b],
    [b, d],
  ];
  const mean: [number, number] = [dot(miss, axisX), dot(miss, axisY)];
  const root = Math.hypot(a - d, 2 * b);
  const major = Math.sqrt((a + d + root) / 2),
    minor = Math.sqrt((a + d - root) / 2);
  const radius = primary.radiusM + secondary.radiusM;
  if (radius / minor > 10)
    throw new Error(
      "Hard-body radius / uncertainty ratio exceeds supported quadrature range",
    );
  const coarse = diskProbability(mean, covariance, radius, 64),
    fine = diskProbability(mean, covariance, radius, 128);
  const error = Math.abs(fine - coarse);
  if (error > Math.max(1e-10, fine * 1e-3))
    throw new Error(
      "Pc quadrature did not converge; use a specialized assessment method",
    );
  return {
    missDistanceM: norm(miss),
    relativeSpeedMs: speed,
    timeOffsetSeconds: time,
    mean,
    covariance,
    ellipse: { major, minor, angle: 0.5 * Math.atan2(2 * b, a - d) },
    pc: fine,
    integrationError: error,
    hardBodyRadiusM: radius,
  };
}
