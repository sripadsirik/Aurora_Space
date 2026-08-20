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

/**
 * Escape velocity at the given orbit radius, in km/s. This is the speed at which
 * an object's total orbital energy reaches zero, `sqrt(2 * mu / r)`, so it marks
 * the boundary between a bound orbit and an escape trajectory. It is always a
 * factor of `sqrt(2)` above the circular orbital speed at the same radius.
 */
export const escapeVelocityKms = (radiusMeters: number): number =>
  Math.sqrt((2 * MU_EARTH) / radiusMeters) / 1000;

/**
 * Specific angular momentum of a circular orbit at the given radius, in km^2/s.
 * For a circular orbit this reduces to `sqrt(mu * r)`, the conserved quantity
 * `r * v` that stays constant along the orbit. Higher orbits carry more angular
 * momentum per unit mass despite their slower speeds.
 */
export const specificAngularMomentumKm2s = (radiusMeters: number): number =>
  Math.sqrt(MU_EARTH * radiusMeters) / 1e6;
