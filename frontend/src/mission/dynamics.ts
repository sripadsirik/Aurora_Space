import { add, norm, scale } from "./math";
import type { StateVector, Vec3 } from "./types";
export const MU = 3.986004418e14;
export const EARTH_RADIUS = 6378137;
const J2 = 1.08262668e-3;
export function acceleration(r: Vec3, model: "two-body" | "J2"): Vec3 {
  const radius = norm(r);
  if (radius < EARTH_RADIUS)
    throw new Error("Trajectory intersects Earth; propagation stopped");
  const base = scale(r, -MU / radius ** 3);
  if (model === "two-body") return base;
  const z2 = (r[2] * r[2]) / (radius * radius),
    factor = (1.5 * J2 * MU * EARTH_RADIUS ** 2) / radius ** 5;
  return add(base, [
    factor * r[0] * (5 * z2 - 1),
    factor * r[1] * (5 * z2 - 1),
    factor * r[2] * (5 * z2 - 3),
  ]);
}
function derivative(s: StateVector, model: "two-body" | "J2"): StateVector {
  return { r: s.v, v: acceleration(s.r, model) };
}
function offset(s: StateVector, d: StateVector, dt: number): StateVector {
  return { r: add(s.r, scale(d.r, dt)), v: add(s.v, scale(d.v, dt)) };
}
export function rk4(
  s: StateVector,
  dt: number,
  model: "two-body" | "J2",
): StateVector {
  const a = derivative(s, model),
    b = derivative(offset(s, a, dt / 2), model),
    c = derivative(offset(s, b, dt / 2), model),
    d = derivative(offset(s, c, dt), model);
  const sum = (key: "r" | "v") =>
    scale(add(add(a[key], scale(add(b[key], c[key]), 2)), d[key]), dt / 6);
  return { r: add(s.r, sum("r")), v: add(s.v, sum("v")) };
}
export function propagateState(
  s: StateVector,
  duration: number,
  step = 10,
  model: "two-body" | "J2" = "J2",
): StateVector {
  if (
    !Number.isFinite(duration) ||
    Math.abs(duration) > 86400 ||
    !Number.isFinite(step) ||
    step < 0.1 ||
    step > 60
  )
    throw new Error(
      "Propagation requires |duration| ≤ 1 day and step 0.1–60 s",
    );
  const count = Math.ceil(Math.abs(duration) / step);
  let result = { r: [...s.r] as Vec3, v: [...s.v] as Vec3 };
  if (!count) return result;
  const dt = duration / count;
  for (let i = 0; i < count; i++) result = rk4(result, dt, model);
  return result;
}
export const specificEnergy = (s: StateVector): number =>
  norm(s.v) ** 2 / 2 - MU / norm(s.r);
