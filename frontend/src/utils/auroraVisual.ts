import { Cartesian3 } from "cesium";

/** Illustrative geographic-pole oval, not an OVATION probability footprint. */
export function auroraRibbon(north: boolean, radius: number, layer = 0) {
  const positions: Cartesian3[] = [], minimumHeights: number[] = [], maximumHeights: number[] = [];
  for (let i = 0; i <= 192; i++) {
    const angle = i / 192 * Math.PI * 2;
    const ripple = Math.sin(angle * 5 + layer * 0.7) * 0.65 + Math.sin(angle * 11) * 0.22;
    const latitude = (north ? 1 : -1) * (90 - radius - layer * 1.25 - ripple);
    positions.push(Cartesian3.fromDegrees(i / 192 * 360 - 180, latitude));
    minimumHeights.push(95_000 + layer * 22_000);
    maximumHeights.push(310_000 + layer * 55_000 + 55_000 * Math.sin(angle * 7 + layer));
  }
  const rim = positions.map((position, i) => {
    const normal = Cartesian3.normalize(position, new Cartesian3());
    return Cartesian3.add(position, Cartesian3.multiplyByScalar(normal, minimumHeights[i] + 20000, normal), new Cartesian3());
  });
  return { positions, minimumHeights, maximumHeights, rim };
}

/** Code-generated emissive curtain texture with transparent, feathered edges. */
export function auroraCurtainTexture(violet = false): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 128;
  const context = canvas.getContext("2d")!;
  for (let x = 0; x < canvas.width; x++) {
    const t = x / canvas.width * Math.PI * 2;
    const intensity = 0.28 + 0.4 * Math.pow((1 + Math.sin(t * 43 + Math.sin(t * 9) * 2)) / 2, 3) + 0.28 * Math.pow((1 + Math.sin(t * 113)) / 2, 8);
    const gradient = context.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, "rgba(138,89,255,0)");
    gradient.addColorStop(0.22, `rgba(155,104,255,${intensity * 0.32})`);
    gradient.addColorStop(0.57, violet ? `rgba(157,117,255,${intensity * 0.65})` : `rgba(48,246,183,${intensity * 0.7})`);
    gradient.addColorStop(0.85, `rgba(125,255,196,${intensity})`);
    gradient.addColorStop(1, "rgba(37,241,155,0)");
    context.fillStyle = gradient; context.fillRect(x, 0, 1, 128);
  }
  return canvas;
}
