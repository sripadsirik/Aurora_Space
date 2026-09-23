import { Cartesian3, Math as CesiumMath } from "cesium";
import { orbitPoint } from "./orbit";

/**
 * The orbital-animation state needed to place a satellite along its ring over
 * time: its circular-orbit geometry (`radius`, `inclination`, `ascendingNode`),
 * its `period` in seconds, and the true anomaly `initialTheta` it occupied at
 * `thetaEpochSeconds` of scene time. The globe's per-satellite render state is a
 * structural superset of this, so it can be passed directly.
 */
export interface SatelliteOrbitAnim {
  radius: number;
  inclination: number;
  ascendingNode: number;
  period: number;
  initialTheta: number;
  thetaEpochSeconds: number;
}

/**
 * True anomaly (radians) of a satellite at `elapsedSeconds` of scene time,
 * advancing from `initialTheta` at the constant angular velocity implied by its
 * orbital period. Time before the theta epoch yields angles behind the initial
 * position, matching the continuous forward/backward sweep of the animation.
 */
export const getSatelliteThetaAtElapsed = (state: SatelliteOrbitAnim, elapsedSeconds: number): number =>
  state.initialTheta + (CesiumMath.TWO_PI / state.period) * (elapsedSeconds - state.thetaEpochSeconds);

/**
 * Position of a satellite on its orbit ring at `elapsedSeconds`, shifted forward
 * along the orbit by `offsetSeconds`. A positive offset looks ahead of the
 * current position (useful for projecting toward a time of closest approach) and
 * a negative offset looks behind it.
 */
export const getSatellitePositionAtOffset = (
  state: SatelliteOrbitAnim,
  elapsedSeconds: number,
  offsetSeconds: number
): Cartesian3 =>
  orbitPoint(
    getSatelliteThetaAtElapsed(state, elapsedSeconds) + (CesiumMath.TWO_PI / state.period) * offsetSeconds,
    state.radius,
    state.inclination,
    state.ascendingNode
  );

/** Default number of samples used to draw a conjunction look-ahead arc. */
export const CONJUNCTION_ARC_POINT_COUNT = 20;

/**
 * Samples a short arc of a satellite's orbit around its current position, biased
 * to look ahead toward a conjunction's time of closest approach. The look-ahead
 * span tracks `timeUntilTcaSeconds` but is bounded to a fraction of the orbital
 * `period` (never less than 4% nor more than 32%), so both imminent and distant
 * conjunctions render a legible arc; a small slice behind the current position
 * is included for context. Returns `pointCount` positions from behind to ahead.
 */
export const createConjunctionOrbitArcPositions = (
  state: SatelliteOrbitAnim,
  elapsedSeconds: number,
  timeUntilTcaSeconds: number,
  pointCount = CONJUNCTION_ARC_POINT_COUNT
): Cartesian3[] => {
  const angularVelocity = CesiumMath.TWO_PI / state.period;
  const lookAheadSeconds = Math.min(
    Math.max(timeUntilTcaSeconds, state.period * 0.04),
    state.period * 0.32
  );
  const startOffsetSeconds = -Math.min(lookAheadSeconds * 0.2, state.period * 0.05);
  const endOffsetSeconds = Math.max(lookAheadSeconds, state.period * 0.08);
  const currentTheta = getSatelliteThetaAtElapsed(state, elapsedSeconds);
  const positions: Cartesian3[] = [];

  for (let index = 0; index < pointCount; index += 1) {
    const t = pointCount === 1 ? 0 : index / (pointCount - 1);
    const offsetSeconds = CesiumMath.lerp(startOffsetSeconds, endOffsetSeconds, t);
    positions.push(
      orbitPoint(
        currentTheta + angularVelocity * offsetSeconds,
        state.radius,
        state.inclination,
        state.ascendingNode
      )
    );
  }

  return positions;
};
