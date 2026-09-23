import { Cartesian3, Math as CesiumMath } from "cesium";
import { clamp } from "./clamp";

/** Default number of samples spanning a flame-cone front from edge to edge. */
export const CME_FLAME_CONE_SEGMENTS = 18;

/**
 * Samples the leading edge of the heliocentric CME "flame" cone at a moment in
 * time. Points fan out from the `sunToEarth` axis across the cone's angular
 * width (half-angle `halfAngle`), spread laterally along `right` and lifted
 * along `up`, then scaled out to `length`. The reach of each sample breathes
 * with `timeSeconds`: a travelling `tongue` term (amplified by `flareScale`) and
 * a faster `flutter` term make the front lick outward, while `liftScale`
 * controls how much the centre of the front rises. The centre reaches furthest
 * and the edges are pulled back, giving the cone a rounded, flickering tip.
 *
 * The result is deterministic for a given `timeSeconds`, so callers drive the
 * animation purely from scene time. Returns `segments + 1` positions.
 */
export const createFireConeFrontPositions = (
  sunToEarth: Cartesian3,
  right: Cartesian3,
  up: Cartesian3,
  length: number,
  halfAngle: number,
  timeSeconds: number,
  flareScale: number,
  liftScale: number,
  segments = CME_FLAME_CONE_SEGMENTS
): Cartesian3[] => {
  const positions: Cartesian3[] = [];
  const spread = Math.tan(halfAngle);

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const lateralFactor = CesiumMath.lerp(-1, 1, t);
    const centerBias = 1 - Math.pow(Math.abs(lateralFactor), 1.45);
    const tongue = Math.max(0, Math.sin(timeSeconds * 4.4 + t * 19)) * centerBias;
    const flutter = Math.sin(timeSeconds * 10.5 + t * 31) * 0.035;
    const forwardScale = clamp(0.8 + centerBias * 0.14 + tongue * (0.22 * flareScale) + flutter, 0.62, 1.28);
    const verticalFactor = Math.sin(timeSeconds * 3.8 + t * 13) * centerBias * liftScale;
    const direction = new Cartesian3(
      sunToEarth.x + lateralFactor * spread * right.x + verticalFactor * up.x,
      sunToEarth.y + lateralFactor * spread * right.y + verticalFactor * up.y,
      sunToEarth.z + lateralFactor * spread * right.z + verticalFactor * up.z
    );

    Cartesian3.normalize(direction, direction);
    positions.push(Cartesian3.multiplyByScalar(direction, length * forwardScale, new Cartesian3()));
  }

  return positions;
};
