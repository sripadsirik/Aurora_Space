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

/**
 * Worst-case eclipse fraction for an orbit, which occurs when the Sun lies in
 * the orbital plane (`betaDeg = 0`). This is the largest share of any orbit the
 * satellite can spend in shadow, useful as an upper bound for power sizing.
 */
export const maxEclipseFraction = (altitudeKm: number): number =>
  eclipseFraction(altitudeKm, 0);

/**
 * Beta angle, in degrees, at which the orbit stops entering Earth's shadow. For
 * any beta magnitude at or above this cutoff the satellite stays in full
 * sunlight for the whole orbit. Equal to `asin(R / (R + h))`, so it shrinks with
 * altitude — higher orbits go eclipse-free at a smaller beta angle.
 */
export const eclipseCutoffBetaDeg = (altitudeKm: number): number => {
  const orbitRadius = ECLIPSE_EARTH_RADIUS_KM + altitudeKm;
  return toDegrees(Math.asin(ECLIPSE_EARTH_RADIUS_KM / orbitRadius));
};

/**
 * Orbital period in minutes for a circular orbit at the given altitude, derived
 * from Kepler's third law on the same spherical Earth radius the eclipse
 * geometry uses so the duration figures stay mutually consistent.
 */
const orbitalPeriodMinutes = (altitudeKm: number): number =>
  getOrbitalPeriod((ECLIPSE_EARTH_RADIUS_KM + altitudeKm) * 1000) / 60;

/**
 * Wall-clock minutes the satellite spends in Earth's shadow on each orbit, the
 * eclipse fraction scaled by the orbital period.
 */
export const eclipseDurationMinutes = (altitudeKm: number, betaDeg = 0): number =>
  eclipseFraction(altitudeKm, betaDeg) * orbitalPeriodMinutes(altitudeKm);
