import type { Satellite } from "../types/space";
import { getOrbitalPeriod } from "./orbit";

/** Mean Earth radius in kilometres (spherical approximation, matches coverageFootprint). */
export const ECLIPSE_EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/**
 * Fraction of a circular orbit that a satellite spends inside Earth's shadow, in
 * the range 0-0.5. Uses the standard cylindrical-shadow model: Earth casts a
 * shadow cylinder of its own radius, and the satellite is eclipsed over the arc
 * where its line to the Sun is blocked.
 *
 * `betaDeg` is the beta angle — the angle between the orbital plane and the
 * Earth-Sun line. At `betaDeg = 0` (the default) the Sun lies in the orbital
 * plane and the eclipse is longest; as the beta angle grows the eclipse shrinks
 * and eventually vanishes once the orbit rides above the shadow entirely.
 */
export const eclipseFraction = (altitudeKm: number, betaDeg = 0): number => {
  const orbitRadius = ECLIPSE_EARTH_RADIUS_KM + altitudeKm;
  const cosBeta = Math.cos(toRadians(betaDeg));
  // A beta angle at or beyond 90 degrees puts the Sun off to the side; the orbit
  // never crosses the shadow cylinder, so there is no eclipse.
  if (cosBeta <= 0) return 0;
  const ratio =
    Math.sqrt(orbitRadius ** 2 - ECLIPSE_EARTH_RADIUS_KM ** 2) / (orbitRadius * cosBeta);
  // Once the geometry lifts the orbit clear of the shadow the ratio reaches 1
  // and the satellite stays in full sunlight.
  if (ratio >= 1) return 0;
  return Math.acos(ratio) / Math.PI;
};

/**
 * Fraction of a circular orbit spent in sunlight, the complement of
 * `eclipseFraction`. Ranges from 0.5 (worst-case low orbit with the Sun in the
 * orbital plane) up to 1 for an orbit that never enters the shadow.
 */
export const sunlightFraction = (altitudeKm: number, betaDeg = 0): number =>
  1 - eclipseFraction(altitudeKm, betaDeg);
