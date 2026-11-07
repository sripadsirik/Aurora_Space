import type { Mat3, Vec3 } from "./types";
export const add = (a: Vec3, b: Vec3): Vec3 =>
  a.map((v, i) => v + b[i]) as Vec3;
export const sub = (a: Vec3, b: Vec3): Vec3 =>
  a.map((v, i) => v - b[i]) as Vec3;
export const scale = (a: Vec3, s: number): Vec3 => a.map((v) => v * s) as Vec3;
export const dot = (a: Vec3, b: Vec3): number =>
  a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = (a: Vec3): number => Math.hypot(...a);
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function unit(a: Vec3): Vec3 {
  const n = norm(a);
  if (n < 1e-12) throw new Error("Degenerate direction vector");
  return scale(a, 1 / n);
}
export const multiply = (m: Mat3, v: Vec3): Vec3 =>
  m.map((row) => dot(row, v)) as Vec3;
export const quad = (a: Vec3, m: Mat3, b: Vec3): number =>
  dot(a, multiply(m, b));
export const sumMatrix = (a: Mat3, b: Mat3): Mat3 =>
  a.map((row, i) => row.map((v, j) => v + b[i][j])) as Mat3;
export function validateCovariance(m: Mat3): void {
  if (
    !Array.isArray(m) ||
    m.length !== 3 ||
    !m.every(
      (r) => Array.isArray(r) && r.length === 3 && r.every(Number.isFinite),
    )
  )
    throw new Error("Covariance requires a finite 3 × 3 matrix");
  const l: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const tolerance = Math.max(...m.flat().map(Math.abs), 1) * 1e-10;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j <= i; j++) {
      if (Math.abs(m[i][j] - m[j][i]) > tolerance)
        throw new Error("Covariance must be symmetric");
      let value = m[i][j];
      for (let k = 0; k < j; k++) value -= l[i][k] * l[j][k];
      if (i === j) {
        if (value <= 0) throw new Error("Covariance must be positive definite");
        l[i][j] = Math.sqrt(value);
      } else l[i][j] = value / l[j][j];
    }
}
/** RTN basis columns expressed in the state's inertial frame. */
export function rtnBasis(r: Vec3, v: Vec3): [Vec3, Vec3, Vec3] {
  const radial = unit(r),
    normal = unit(cross(r, v));
  return [radial, cross(normal, radial), normal];
}
export function rotateCovariance(c: Mat3, basis: [Vec3, Vec3, Vec3]): Mat3 {
  return [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) => {
      let x = 0;
      for (let a = 0; a < 3; a++)
        for (let b = 0; b < 3; b++) x += basis[a][i] * c[a][b] * basis[b][j];
      return x;
    }),
  ) as Mat3;
}
