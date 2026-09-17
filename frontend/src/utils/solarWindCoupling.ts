/**
 * Solar-wind–magnetosphere coupling via the dawn-dusk merging electric field.
 *
 * When the interplanetary magnetic field turns southward it reconnects with
 * Earth's northward dipole at the dayside magnetopause, opening flux that the
 * solar wind then drags into the tail — the engine that drives geomagnetic
 * storms. The strength of that coupling is captured by the dawn-dusk merging
 * (motional) electric field `VBs = v * Bs`, where `Bs` is the southward part of
 * the IMF: only a southward field is geoeffective, so the northward half is
 * rectified away. These helpers turn the solar-wind speed and Bz the feeds
 * already report into that coupling field and a qualitative band, keeping the
 * derived figures in one place alongside the ram-pressure profile.
 */

import type { SpaceWeather } from "../types/space";

/**
 * Southward IMF magnitude `Bs` in nanotesla: the half-wave rectified southward
 * component of Bz. A southward field (Bz < 0) is geoeffective and returns its
 * magnitude `|Bz|`; a northward or zero field returns `0`. Non-finite readings
 * are treated as not southward, matching the "closed magnetosphere" branch, so
 * a bad feed value yields `0` rather than `NaN`.
 */
export const southwardBz = (bz: number): number => {
  if (!Number.isFinite(bz) || bz >= 0) return 0;
  return -bz;
};

/**
 * Coefficient that converts a solar-wind speed (km/s) and southward field
 * (nT) into a merging electric field in millivolts per metre via
 * `E = k * v * Bs`. It folds the km/s -> m/s (`1e3`), nT -> T (`1e-9`), and
 * V/m -> mV/m (`1e3`) unit conversions into a single factor, so a 400 km/s wind
 * with a 5 nT southward field gives `1e-3 * 400 * 5 = 2 mV/m`.
 */
export const MERGING_FIELD_COEFFICIENT = 1e-3;

/**
 * Dawn-dusk merging (motional) electric field `VBs` in millivolts per metre for
 * the given solar-wind speed (km/s) and IMF Bz (nT), from `E = k * v * Bs`.
 * Only the southward part of Bz contributes (see {@link southwardBz}), so a
 * northward field yields `0`. Non-finite or negative speeds are treated as
 * zero, so a bad feed value yields `0` rather than a `NaN` field.
 */
export const mergingElectricFieldMvM = (speedKms: number, bz: number): number => {
  if (!Number.isFinite(speedKms)) return 0;
  const speed = Math.max(0, speedKms);
  return MERGING_FIELD_COEFFICIENT * speed * southwardBz(bz);
};

/** Qualitative bands for the merging-field coupling, from quiet to storm-level. */
export type CouplingLevel = "quiet" | "moderate" | "strong" | "extreme";

/**
 * Buckets a merging electric field (mV/m) into a qualitative coupling band for
 * the readouts. Below 0.5 mV/m the field is `quiet` — a northward or weak IMF
 * feeds little energy in; 0.5-3 mV/m is `moderate`, sustained coupling that can
 * seed a storm; 3-8 mV/m is `strong`, the driving seen in intense storms; and
 * 8 mV/m or more is `extreme`, the coupling that accompanies a major
 * CME-driven storm. The thresholds are approximate operational bands. Negative
 * or non-finite inputs fall back to `quiet`.
 */
export const couplingLevel = (fieldMvM: number): CouplingLevel => {
  if (!Number.isFinite(fieldMvM) || fieldMvM < 0.5) return "quiet";
  if (fieldMvM < 3) return "moderate";
  if (fieldMvM < 8) return "strong";
  return "extreme";
};

/**
 * Short status label for a coupling band, for a magnetosphere readout that
 * mirrors the Bz shield label: a `quiet` field reads as `DECOUPLED` (the wind
 * slides past a closed magnetosphere), `moderate` as `COUPLING`, `strong` as
 * `STRONG COUPLING`, and `extreme` as `EXTREME COUPLING`.
 */
export const couplingLevelLabel = (level: CouplingLevel): string => {
  switch (level) {
    case "quiet":
      return "DECOUPLED";
    case "moderate":
      return "COUPLING";
    case "strong":
      return "STRONG COUPLING";
    case "extreme":
      return "EXTREME COUPLING";
  }
};

/** Derived solar-wind coupling figures for the current space-weather state. */
export interface SolarWindCouplingProfile {
  /** Southward IMF magnitude `Bs` driving the coupling, in nanotesla. */
  southwardBzNt: number;
  /** Dawn-dusk merging electric field `VBs`, in millivolts per metre. */
  mergingFieldMvM: number;
  /** Qualitative band the merging field falls in. */
  level: CouplingLevel;
  /** True when the IMF is southward and therefore actively coupling. */
  coupling: boolean;
}

/**
 * Bundles the coupling figures derived from a space-weather snapshot: the
 * southward IMF magnitude, the dawn-dusk merging electric field its speed and
 * Bz imply, the qualitative coupling band, and whether the field is southward
 * at all. All values come from the same rectified Bz, so they stay mutually
 * consistent — a northward field yields a zero field, a `quiet` band, and
 * `coupling: false`.
 */
export const solarWindCouplingProfile = (
  weather: SpaceWeather
): SolarWindCouplingProfile => {
  const southwardBzNt = southwardBz(weather.bzComponent);
  const mergingFieldMvM = mergingElectricFieldMvM(
    weather.solarWindSpeed,
    weather.bzComponent
  );
  return {
    southwardBzNt,
    mergingFieldMvM,
    level: couplingLevel(mergingFieldMvM),
    coupling: southwardBzNt > 0
  };
};
