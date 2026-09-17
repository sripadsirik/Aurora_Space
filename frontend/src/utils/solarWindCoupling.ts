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
