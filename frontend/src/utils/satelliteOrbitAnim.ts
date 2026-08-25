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
