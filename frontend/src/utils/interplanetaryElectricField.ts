/**
 * Interplanetary (dawn-dusk) electric field and its geoeffective component.
 *
 * As the magnetised solar wind sweeps past Earth it carries a motional electric
 * field `E = -v x B`. The dawn-dusk component of that field, driven by the
 * north-south (Bz) part of the interplanetary magnetic field, is what couples
 * the solar wind to the magnetosphere: a southward IMF reconnects with Earth's
 * field and imposes a cross-tail electric field that drives convection, the ring
 * current, and the auroral electrojets. These helpers turn the bulk speed and Bz
 * the feeds already report into a dawn-dusk field in mV/m, keeping the derived
 * coupling figure in one place.
 */

import type { SpaceWeather } from "../types/space";

/**
 * Converts a bulk speed in km/s and a field in nT into an electric field in
 * mV/m via `E = v * B`. It folds the km/s -> m/s (1e3), nT -> T (1e-9), and
 * V/m -> mV/m (1e3) unit conversions into a single factor (`1e3 * 1e-9 * 1e3`).
 */
export const ELECTRIC_FIELD_COEFFICIENT = 1e-3;

/**
 * Signed dawn-dusk interplanetary electric field in mV/m for the given bulk
 * speed (km/s) and IMF Bz (nT), from `Ey = -v * Bz`. A southward field
 * (Bz < 0) yields a positive dawn-dusk field — the geoeffective, convection
 * driving case — while a northward field yields a negative value. Non-finite
 * inputs are treated as zero so a bad feed reading yields `0` rather than a
 * `NaN` field. The speed is clamped to be non-negative; the wind never blows
 * back toward the Sun.
 */
export const interplanetaryElectricField = (speedKms: number, bzNt: number): number => {
  if (!Number.isFinite(speedKms) || !Number.isFinite(bzNt)) return 0;
  const speed = Math.max(0, speedKms);
  return -ELECTRIC_FIELD_COEFFICIENT * speed * bzNt;
};
