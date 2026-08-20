import type { Satellite } from "../types/space";
import { getOrbitParams } from "./orbit";

// Standard gravitational parameter (GM) for Earth, in m^3/s^2. Kept in step with
// the value used by the orbit helpers so every derived energy figure lines up
// with the periods and speeds computed elsewhere.
const MU_EARTH = 3.986004418e14;

/**
 * Specific orbital energy of a circular orbit at the given radius, in megajoules
 * per kilogram (MJ/kg). For a circular orbit this is `-mu / (2 * r)`, so the
 * value is always negative for a bound orbit and rises toward zero as the radius
 * grows — a satellite in a higher orbit is less tightly bound to Earth.
 */
export const specificOrbitalEnergyMJ = (radiusMeters: number): number =>
  -MU_EARTH / (2 * radiusMeters) / 1e6;
