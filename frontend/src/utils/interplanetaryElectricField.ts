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

/**
 * Half-wave rectified dawn-dusk electric field in mV/m: the geoeffective part of
 * `interplanetaryElectricField` that actually drives the magnetosphere. Only a
 * southward IMF reconnects, so a northward field contributes nothing and this
 * returns `0` rather than a negative value. This is the quantity coupling
 * functions such as the ring-current and auroral-electrojet drivers depend on,
 * so a northward interval reads as no forcing rather than negative forcing.
 */
export const geoeffectiveElectricField = (speedKms: number, bzNt: number): number =>
  Math.max(0, interplanetaryElectricField(speedKms, bzNt));

/** Qualitative bands for the geoeffective dawn-dusk field, from calm to storm-driving. */
export type ElectricFieldLevel = "quiet" | "moderate" | "strong" | "extreme";

/**
 * Buckets a geoeffective dawn-dusk field (mV/m) into a qualitative band for the
 * readouts: below 0.5 mV/m is `quiet` (little coupling, including any northward
 * interval that rectifies to zero), 0.5-3 mV/m is `moderate` convection forcing,
 * 3-10 mV/m is `strong` (main-phase storm driving), and 10 mV/m or more is
 * `extreme` — the coupling seen in the great storms. Negative or non-finite
 * inputs fall back to `quiet`.
 */
export const electricFieldLevel = (fieldMvM: number): ElectricFieldLevel => {
  if (!Number.isFinite(fieldMvM) || fieldMvM < 0.5) return "quiet";
  if (fieldMvM < 3) return "moderate";
  if (fieldMvM < 10) return "strong";
  return "extreme";
};

/** Short, uppercase status labels for each geoeffective-field band. */
const COUPLING_LABELS: Record<ElectricFieldLevel, string> = {
  quiet: "WEAK COUPLING",
  moderate: "MODERATE COUPLING",
  strong: "STRONG COUPLING",
  extreme: "EXTREME COUPLING"
};

/**
 * Maps a geoeffective-field band to the short status label the heliocentric
 * overlay shows for solar-wind/magnetosphere coupling, from `WEAK COUPLING`
 * (little forcing, including any rectified northward interval) up to
 * `EXTREME COUPLING` for great-storm driving.
 */
export const couplingLabel = (level: ElectricFieldLevel): string => COUPLING_LABELS[level];

/** Derived interplanetary electric field figures for the current solar-wind state. */
export interface ElectricFieldProfile {
  /** Signed dawn-dusk field (positive for a southward, geoeffective IMF), in mV/m. */
  fieldMvM: number;
  /** Half-wave rectified geoeffective field that actually drives the magnetosphere, in mV/m. */
  geoeffectiveMvM: number;
  /** Qualitative band the geoeffective field falls in. */
  level: ElectricFieldLevel;
  /** True when the IMF is southward, so the coupling field is geoeffective. */
  southward: boolean;
}

/**
 * Bundles the interplanetary electric field figures derived from a space-weather
 * snapshot: the signed dawn-dusk field from its solar-wind speed and IMF Bz, the
 * rectified geoeffective field, the qualitative band that field falls in, and
 * whether the IMF is currently southward. The band is keyed off the geoeffective
 * field, so a northward interval always reads as `quiet` regardless of speed.
 */
export const electricFieldProfile = (weather: SpaceWeather): ElectricFieldProfile => {
  const fieldMvM = interplanetaryElectricField(weather.solarWindSpeed, weather.bzComponent);
  const geoeffectiveMvM = Math.max(0, fieldMvM);
  return {
    fieldMvM,
    geoeffectiveMvM,
    level: electricFieldLevel(geoeffectiveMvM),
    southward: fieldMvM > 0
  };
};
