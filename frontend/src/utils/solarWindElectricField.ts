/**
 * Interplanetary (solar-wind) dawn-to-dusk electric field.
 *
 * The solar wind carries the interplanetary magnetic field (IMF) past Earth at
 * hundreds of kilometres a second, and a moving magnetic field is an electric
 * field: `E = -v x B`. The dawn-to-dusk (Ey) component of that field is the
 * quantity space-weather forecasters watch, because a southward IMF turns it
 * geoeffective and lets the solar wind reconnect with the magnetosphere and pour
 * energy in. These helpers turn the bulk speed and IMF Bz the feeds already
 * report into that electric field in millivolts per metre, keeping the derived
 * figure in one tested place.
 */

import type { SpaceWeather } from "../types/space";

/**
 * Coefficient that converts a bulk speed (km/s) and a magnetic field (nT) into
 * an electric field in millivolts per metre via `E = k * v * B`. It folds the
 * km/s -> m/s (`1e3`), nT -> T (`1e-9`), and V/m -> mV/m (`1e3`) unit
 * conversions into a single factor (`1e3 * 1e-9 * 1e3 = 1e-3`).
 */
export const ELECTRIC_FIELD_COEFFICIENT = 1e-3;

/**
 * Magnitude of the interplanetary dawn-to-dusk electric field in millivolts per
 * metre for the given solar-wind bulk speed (km/s) and IMF magnitude (nT), from
 * `E = v * B`. This is the raw motional field regardless of the field's
 * orientation; use {@link geoeffectiveElectricField} for the rectified,
 * reconnection-driving part. Non-finite inputs are treated as zero and the
 * speed and field are taken by magnitude, so a bad feed value yields `0` rather
 * than a `NaN` or negative field.
 */
export const solarWindElectricField = (speedKms: number, fieldNt: number): number => {
  if (!Number.isFinite(speedKms) || !Number.isFinite(fieldNt)) return 0;
  const speed = Math.abs(speedKms);
  const field = Math.abs(fieldNt);
  return ELECTRIC_FIELD_COEFFICIENT * speed * field;
};

/**
 * Geoeffective dawn-to-dusk electric field in millivolts per metre for the
 * given solar-wind bulk speed (km/s) and IMF Bz (nT). Only a southward field
 * (`Bz < 0`) opens dayside reconnection, so this rectifies the field: it uses
 * `|Bz|` when Bz is southward and returns `0` for a northward or zero Bz. This
 * is the reconnection-driving part of {@link solarWindElectricField} and the
 * value that best tracks geomagnetic activity. Non-finite inputs yield `0`.
 */
export const geoeffectiveElectricField = (speedKms: number, bz: number): number => {
  if (!Number.isFinite(bz) || bz >= 0) return 0;
  return solarWindElectricField(speedKms, bz);
};

/** Qualitative bands for the geoeffective electric field, from calm to storm. */
export type ElectricFieldLevel = "quiet" | "moderate" | "strong" | "extreme";

/**
 * Buckets a geoeffective electric field (mV/m) into a qualitative band for the
 * readouts: below 0.8 mV/m is `quiet` (little coupling), 0.8-3 mV/m is
 * `moderate` (substorm-level driving), 3-8 mV/m is `strong` (storm main-phase
 * driving), and 8 mV/m or more is `extreme` — the sustained driving that builds
 * a major geomagnetic storm. Negative or non-finite inputs fall back to `quiet`.
 */
export const electricFieldLevel = (fieldMvM: number): ElectricFieldLevel => {
  if (!Number.isFinite(fieldMvM) || fieldMvM < 0.8) return "quiet";
  if (fieldMvM < 3) return "moderate";
  if (fieldMvM < 8) return "strong";
  return "extreme";
};

/**
 * Short human-readable label for each {@link ElectricFieldLevel}, for legends,
 * badges, and panel copy. Centralised so every display names the bands the same.
 */
export const ELECTRIC_FIELD_LEVEL_LABELS: Record<ElectricFieldLevel, string> = {
  quiet: "Quiet",
  moderate: "Moderate",
  strong: "Strong",
  extreme: "Extreme"
};

/** Derived electric-field figures for the current solar-wind state. */
export interface SolarWindElectricFieldProfile {
  /** Motional dawn-to-dusk field magnitude regardless of IMF sign, in mV/m. */
  fieldMvM: number;
  /** Rectified, reconnection-driving field (zero for a northward IMF), in mV/m. */
  geoeffectiveMvM: number;
  /** True when the IMF is southward, so the field is geoeffective. */
  southward: boolean;
  /** Qualitative band the geoeffective field falls in. */
  level: ElectricFieldLevel;
}

/**
 * Bundles the electric-field figures derived from a space-weather snapshot: the
 * raw motional field from its solar-wind speed and IMF magnitude, the rectified
 * geoeffective field from the Bz sign, whether the IMF is southward, and the
 * qualitative band the geoeffective field falls in. Every value comes from the
 * same speed and Bz, so they stay mutually consistent.
 */
export const solarWindElectricFieldProfile = (
  weather: SpaceWeather
): SolarWindElectricFieldProfile => {
  const geoeffectiveMvM = geoeffectiveElectricField(weather.solarWindSpeed, weather.bzComponent);
  return {
    fieldMvM: solarWindElectricField(weather.solarWindSpeed, weather.bzComponent),
    geoeffectiveMvM,
    southward: weather.bzComponent < 0,
    level: electricFieldLevel(geoeffectiveMvM)
  };
};
