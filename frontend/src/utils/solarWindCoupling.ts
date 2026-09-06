/**
 * Solar-wind coupling: the geoeffective (dawn-dusk) electric field the wind
 * imposes on the magnetosphere.
 *
 * When the interplanetary magnetic field turns southward, the solar wind sweeps
 * a motional electric field `E = V × B` across the dayside magnetosphere that
 * drives reconnection, feeds the ring current, and sets how hard a stream
 * couples into geomagnetic activity. Only the southward part of the field is
 * geoeffective, so the driver is the rectified dawn-dusk field `Ey = V · Bs`,
 * where `Bs` is the southward IMF magnitude (`Bs = max(0, -Bz)`). A northward
 * field leaves the magnetosphere comparatively closed and drives no coupling.
 *
 * These helpers turn the bulk speed and Bz the feeds already report into that
 * single coupling figure in mV/m, keeping the derived quantity in one place.
 */

import type { SpaceWeather } from "../types/space";
import { isBzSouthward } from "./bzComponent";

/**
 * Geoeffective dawn-dusk solar-wind electric field in millivolts per metre for
 * the given bulk speed (km/s) and IMF Bz component (nT), from the rectified
 * field `Ey = V · Bs`, where `Bs = max(0, -Bz)` is the southward field
 * magnitude. Only a southward field couples, so a northward or zero Bz yields
 * `0`. The `km/s · nT -> mV/m` unit conversion works out to a factor of `1e-3`
 * (`1e3 m/s · 1e-9 T · 1e3 mV/V`). Non-finite inputs are treated as zero so a
 * bad feed value yields `0` rather than a `NaN` field.
 */
export const geoeffectiveElectricField = (speedKms: number, bz: number): number => {
  if (!Number.isFinite(speedKms) || !Number.isFinite(bz)) return 0;
  if (!isBzSouthward(bz)) return 0;
  const speed = Math.max(0, speedKms);
  const southwardField = -bz;
  return speed * southwardField * 1e-3;
};

/** Qualitative bands for the geoeffective electric field, from closed to storm-driving. */
export type CouplingLevel = "closed" | "weak" | "moderate" | "strong";

/**
 * Buckets a geoeffective electric field (mV/m) into a qualitative coupling band
 * for the readouts: a field of `0` (a northward or zero IMF) reads as `closed`,
 * below 2 mV/m is `weak` background coupling, 2-5 mV/m is `moderate` (a
 * geoeffective southward stream), and 5 mV/m or more is `strong` — the sustained
 * driving that builds major storms. Negative or non-finite inputs fall back to
 * `closed`.
 */
export const couplingLevel = (fieldMvM: number): CouplingLevel => {
  if (!Number.isFinite(fieldMvM) || fieldMvM <= 0) return "closed";
  if (fieldMvM < 2) return "weak";
  if (fieldMvM < 5) return "moderate";
  return "strong";
};

/**
 * Geoeffective electric field (mV/m) at or above which coupling reads as strong
 * enough to drive a major geomagnetic storm. Marks the lower edge of the
 * `strong` {@link couplingLevel} band.
 */
export const STRONG_COUPLING_FIELD_MVM = 5;

/**
 * True when the geoeffective electric field is at or above the strong-coupling
 * threshold, the sustained dawn-dusk driving associated with major storms.
 * Non-finite inputs read as not strongly coupled.
 */
export const isStrongGeomagneticCoupling = (fieldMvM: number): boolean =>
  Number.isFinite(fieldMvM) && fieldMvM >= STRONG_COUPLING_FIELD_MVM;

/**
 * Maps a coupling band to the short uppercase label the readouts show: `CLOSED`,
 * `WEAK`, `MODERATE`, or `STRONG`. Keeps the display wording for each band in one
 * place so panels and overlays label the coupling the same way.
 */
export const couplingLevelLabel = (level: CouplingLevel): string => {
  switch (level) {
    case "closed":
      return "CLOSED";
    case "weak":
      return "WEAK";
    case "moderate":
      return "MODERATE";
    case "strong":
      return "STRONG";
  }
};

/** Derived solar-wind coupling figures for the current space-weather state. */
export interface SolarWindCouplingProfile {
  /** Geoeffective dawn-dusk electric field, in millivolts per metre. */
  electricFieldMvM: number;
  /** Qualitative band the coupling field falls in. */
  level: CouplingLevel;
  /** True when the field is at or above the strong-coupling threshold. */
  strong: boolean;
}

/**
 * Bundles the coupling figures derived from a space-weather snapshot: the
 * geoeffective electric field from its solar-wind speed and Bz, the qualitative
 * coupling band, and whether the field has reached the strong-coupling
 * threshold. All values come from the same computed field, so they stay
 * mutually consistent.
 */
export const solarWindCouplingProfile = (weather: SpaceWeather): SolarWindCouplingProfile => {
  const electricFieldMvM = geoeffectiveElectricField(
    weather.solarWindSpeed,
    weather.bzComponent
  );
  return {
    electricFieldMvM,
    level: couplingLevel(electricFieldMvM),
    strong: isStrongGeomagneticCoupling(electricFieldMvM)
  };
};
