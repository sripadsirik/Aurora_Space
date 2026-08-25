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
