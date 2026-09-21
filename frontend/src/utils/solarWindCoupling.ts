/**
 * Solar-wind–magnetosphere coupling via the dawn-dusk electric field.
 *
 * The rate at which the solar wind pours energy into the magnetosphere is set
 * mostly by the motional electric field it carries, `E = V * B`, and by how much
 * of the interplanetary field points *southward* to reconnect with Earth's own.
 * A fast wind carrying a strong southward field drives reconnection hard and
 * feeds the ring current; a northward field barely couples at all. These helpers
 * turn the bulk speed and Bz the feeds already report into a dawn-dusk electric
 * field in mV/m and a qualitative coupling band, keeping the derived figures in
 * one place beside the ram-pressure helpers.
 */

import type { SpaceWeather } from "../types/space";

/**
 * Coefficient that converts a bulk speed (km/s) and a field (nT) into a motional
 * electric field in mV/m via `E = k * V * B`. It folds the km/s -> m/s
 * (`1e3`), nT -> T (`1e-9`), and V/m -> mV/m (`1e3`) unit conversions into the
 * single factor `1e3 * 1e-9 * 1e3 = 1e-3`.
 */
export const MERGING_FIELD_COEFFICIENT = 1e-3;

/**
 * The motional (dawn-dusk) electric field magnitude in mV/m carried by a solar
 * wind of the given bulk speed (km/s) and field magnitude (nT), from
 * `E = k * V * B`. The field magnitude is taken as an absolute value, so the sign
 * of `bzNt` does not matter here — this is the total field the wind carries, not
 * the geoeffective part (see {@link geoeffectiveElectricField}). Non-finite
 * inputs are treated as zero so a bad feed value yields `0` rather than `NaN`.
 */
export const dawnDuskElectricField = (speedKms: number, bzNt: number): number => {
  if (!Number.isFinite(speedKms) || !Number.isFinite(bzNt)) return 0;
  const speed = Math.max(0, speedKms);
  return MERGING_FIELD_COEFFICIENT * speed * Math.abs(bzNt);
};

/**
 * The *geoeffective* dawn-dusk electric field in mV/m: the part of the motional
 * field that actually drives dayside reconnection. Only a southward (negative)
 * Bz reconnects efficiently with Earth's northward-pointing dayside field, so a
 * northward or zero Bz contributes nothing and this returns `0`. For a southward
 * field it equals {@link dawnDuskElectricField}. Non-finite inputs yield `0`.
 */
export const geoeffectiveElectricField = (speedKms: number, bzNt: number): number => {
  if (!Number.isFinite(bzNt) || bzNt >= 0) return 0;
  return dawnDuskElectricField(speedKms, bzNt);
};

/**
 * Ring-current injection threshold in mV/m. Below this geoeffective field the
 * ring current decays faster than the solar wind can feed it, so no net storm
 * growth occurs. This is the `Ec` of the Burton et al. (1975) `Dst` model, whose
 * canonical value is ~0.5 mV/m.
 */
export const RING_CURRENT_INJECTION_THRESHOLD_MV_M = 0.5;

/** Qualitative bands for the geoeffective coupling field, from calm to storm. */
export type CouplingLevel = "quiet" | "elevated" | "high" | "extreme";

/**
 * Buckets a geoeffective electric field (mV/m) into a qualitative coupling band
 * for the readouts: below the {@link RING_CURRENT_INJECTION_THRESHOLD_MV_M} of
 * 0.5 mV/m no storm growth occurs (`quiet`); 0.5-3 mV/m sustains the ring current
 * enough for `elevated` activity; 3-8 mV/m drives `high` storm-level coupling;
 * and 8 mV/m or more is the `extreme` forcing seen behind a strong CME shock. The
 * upper bands are display thresholds rather than a formal scale. Negative or
 * non-finite inputs fall back to `quiet`.
 */
export const couplingLevel = (fieldMvM: number): CouplingLevel => {
  if (!Number.isFinite(fieldMvM) || fieldMvM < RING_CURRENT_INJECTION_THRESHOLD_MV_M) {
    return "quiet";
  }
  if (fieldMvM < 3) return "elevated";
  if (fieldMvM < 8) return "high";
  return "extreme";
};

/** CSS hex colour for each coupling band, escalating from calm cyan to red. */
const couplingLevelColorMap: Record<CouplingLevel, string> = {
  quiet: "#3ad6ff",
  elevated: "#ffcc00",
  high: "#ff6600",
  extreme: "#ff0000"
};

/**
 * Returns the CSS hex colour for a coupling band. Unknown values fall back to
 * the calm `quiet` cyan, so a display can pass a raw string without guarding.
 */
export const couplingLevelColor = (level: string): string =>
  couplingLevelColorMap[level as CouplingLevel] ?? couplingLevelColorMap.quiet;

/**
 * Short human labels for each coupling band, for legends and badges. Centralised
 * so every display names the bands identically.
 */
export const COUPLING_LEVEL_LABELS: Record<CouplingLevel, string> = {
  quiet: "Weak coupling",
  elevated: "Elevated coupling",
  high: "Strong coupling",
  extreme: "Extreme coupling"
};

/** Derived solar-wind–magnetosphere coupling figures for the current state. */
export interface SolarWindCouplingProfile {
  /** Total motional (dawn-dusk) electric field the wind carries, in mV/m. */
  dawnDuskFieldMvM: number;
  /** The southward, reconnection-driving part of that field, in mV/m. */
  geoeffectiveFieldMvM: number;
  /** True when Bz points southward, so the field couples to the dayside. */
  southward: boolean;
  /** Qualitative band the geoeffective field falls in. */
  level: CouplingLevel;
}

/**
 * Bundles the coupling figures derived from a space-weather snapshot: the total
 * dawn-dusk field from its solar-wind speed and Bz, the southward geoeffective
 * part that drives reconnection, whether Bz points southward at all, and the
 * qualitative band the geoeffective field falls in. The band is derived from the
 * same geoeffective field it reports, so the figures stay mutually consistent.
 */
export const solarWindCouplingProfile = (
  weather: SpaceWeather
): SolarWindCouplingProfile => {
  const dawnDuskFieldMvM = dawnDuskElectricField(
    weather.solarWindSpeed,
    weather.bzComponent
  );
  const geoeffectiveFieldMvM = geoeffectiveElectricField(
    weather.solarWindSpeed,
    weather.bzComponent
  );
  return {
    dawnDuskFieldMvM,
    geoeffectiveFieldMvM,
    southward: Number.isFinite(weather.bzComponent) && weather.bzComponent < 0,
    level: couplingLevel(geoeffectiveFieldMvM)
  };
};
