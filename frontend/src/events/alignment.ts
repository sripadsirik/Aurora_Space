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

// Location samples have no lane information. Fit small offsets to the racing
// surface while preserving larger deviations such as a pit-lane excursion.
export function circuitPose(
  point: XY,
  circuit: XY[],
  tolerance: number,
): { position: XY; tangent?: XY } {
  let best = point;
  let tangent: XY | undefined;
  let nearest = tolerance * tolerance;
  for (let i = 1; i < circuit.length; i++) {
    const [x, y] = circuit[i - 1];
    const dx = circuit[i][0] - x,
      dy = circuit[i][1] - y;
    const length2 = dx * dx + dy * dy;
    if (!length2) continue;
    const t = Math.max(
      0,
      Math.min(1, ((point[0] - x) * dx + (point[1] - y) * dy) / length2),
    );
    const px = x + t * dx,
      py = y + t * dy;
    const distance = (point[0] - px) ** 2 + (point[1] - py) ** 2;
    if (distance < nearest) {
      nearest = distance;
      best = [px, py];
      tangent = [dx / Math.sqrt(length2), dy / Math.sqrt(length2)];
    }
  }
  return { position: best, tangent };
}

// Cesium rotates the glTF +Z nose onto local +X. Its heading is clockwise
// from east, while north is the positive Y axis of the circuit map.
export function carHeading(
  east: number,
  north: number,
  previous: number,
): number {
  return Math.hypot(east, north) > 0.05 ? Math.atan2(-north, east) : previous;
}

// Project heading onto the racing surface even when consecutive samples jitter
// across it. For pit-lane excursions, use the measured direction of travel.
export function trackHeading(
  tangent: XY | undefined,
  motion: XY,
  previous?: number,
) {
  if (!tangent) return carHeading(...motion, previous ?? 0);
  const dot = tangent[0] * motion[0] + tangent[1] * motion[1];
  let direction = Math.sign(dot);
  if (Math.abs(dot) < 0.5) {
    if (previous !== undefined) return previous;
    direction = 1;
  }
  return carHeading(
    direction * tangent[0],
    direction * tangent[1],
    previous ?? 0,
  );
}
