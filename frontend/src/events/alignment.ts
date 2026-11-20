export type XY = [number, number];
export interface Alignment {
  scale: number;
  angle: number;
  tx: number;
  ty: number;
  error: number;
  reflection: number;
}
export function transform(p: XY, a: Alignment): XY {
  const c = Math.cos(a.angle) * a.scale,
    s = Math.sin(a.angle) * a.scale;
  return [
    c * p[0] - s * p[1] * a.reflection + a.tx,
    s * p[0] + c * p[1] * a.reflection + a.ty,
  ];
}
export function localTrack(coordinates: number[][]): {
  points: XY[];
  lon: number;
  lat: number;
} {
  const lon = coordinates.reduce((s, p) => s + p[0], 0) / coordinates.length,
    lat = coordinates.reduce((s, p) => s + p[1], 0) / coordinates.length;
  return {
    lon,
    lat,
    points: coordinates.map((p) => [
      (p[0] - lon) * 111320 * Math.cos((lat * Math.PI) / 180),
      (p[1] - lat) * 111320,
    ]),
  };
}
// Fit the arbitrary telemetry coordinate frame to a surveyed circuit. Both
// handednesses and initial headings are searched, then refined with ICP.
export function align(samples: XY[], track: XY[]): Alignment | null {
  if (samples.length < 30 || track.length < 10) return null;
  const src = samples.filter(
    (p, i) =>
      i % Math.max(1, Math.floor(samples.length / 140)) === 0 &&
      p.every(Number.isFinite),
  );
  if (src.length < 30) return null;
  const target: XY[] = [];
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1],
      b = track[i],
      n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20));
    for (let j = 0; j < n; j++)
      target.push([
        a[0] + ((b[0] - a[0]) * j) / n,
        a[1] + ((b[1] - a[1]) * j) / n,
      ]);
  }
  const mean = (ps: XY[]): XY => [
    ps.reduce((s, p) => s + p[0], 0) / ps.length,
    ps.reduce((s, p) => s + p[1], 0) / ps.length,
  ];
  const cm = mean(src),
    tm = mean(target);
  const extent = (ps: XY[]) =>
    Math.hypot(
      Math.max(...ps.map((p) => p[0])) - Math.min(...ps.map((p) => p[0])),
      Math.max(...ps.map((p) => p[1])) - Math.min(...ps.map((p) => p[1])),
    );
  const scale = extent(target) / extent(src);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  let best: Alignment | null = null;
  for (const reflection of [1, -1])
    for (let deg = 0; deg < 360; deg += 15) {
      let fit: Alignment = {
        scale,
        angle: (deg * Math.PI) / 180,
        tx: 0,
        ty: 0,
        error: Infinity,
        reflection,
      };
      const center = transform(cm, fit);
      fit.tx = tm[0] - center[0];
      fit.ty = tm[1] - center[1];
      for (let iter = 0; iter < 14; iter++) {
        const matches = src
          .map((p) => {
            const q = transform(p, fit);
            let d = Infinity,
              v = target[0];
            for (const t of target) {
              const dist = (q[0] - t[0]) ** 2 + (q[1] - t[1]) ** 2;
              if (dist < d) {
                d = dist;
                v = t;
              }
            }
            return { p, t: v, d };
          })
          .sort((a, b) => a.d - b.d)
          .slice(0, Math.floor(src.length * 0.92));
        const pm = mean(matches.map((x) => x.p)),
          qm = mean(matches.map((x) => x.t));
        let dot = 0,
          cross = 0,
          den = 0;
        for (const { p, t } of matches) {
          const x = p[0] - pm[0],
            y = (p[1] - pm[1]) * reflection,
            u = t[0] - qm[0],
            v = t[1] - qm[1];
          dot += x * u + y * v;
          cross += x * v - y * u;
          den += x * x + y * y;
        }
        if (!den) break;
        fit = {
          scale: Math.hypot(dot, cross) / den,
          angle: Math.atan2(cross, dot),
          tx: 0,
          ty: 0,
          error: Math.sqrt(
            matches.reduce((s, x) => s + x.d, 0) / matches.length,
          ),
          reflection,
        };
        const m = transform(pm, fit);
        fit.tx = qm[0] - m[0];
        fit.ty = qm[1] - m[1];
      }
      if (!best || fit.error < best.error) best = fit;
    }
  return best && best.error < 65 ? best : null;
}
