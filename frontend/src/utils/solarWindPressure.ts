/**
 * Solar-wind ram (dynamic) pressure and its effect on the dayside magnetopause.
 *
 * The solar wind pushes on Earth's magnetosphere with a ram pressure set by the
 * proton density and bulk speed. That pressure balances against the compressed
 * geomagnetic field to fix the subsolar magnetopause standoff distance, so a
 * gust of fast, dense wind squeezes the boundary inward. These helpers turn the
 * density and speed the feeds already report into a dynamic pressure in nPa and
 * a standoff distance in Earth radii, keeping the derived figures in one place.
 */

/**
 * Coefficient that converts proton density (cm^-3) and bulk speed (km/s) into a
 * dynamic pressure in nanopascals via `Pdyn = k * n * v^2`. It folds the proton
 * mass and the cm^-3 -> m^-3, km/s -> m/s, and Pa -> nPa unit conversions into a
 * single factor (`1.6726e-27 kg * 1e6 * 1e6 * 1e9`).
 */
export const DYNAMIC_PRESSURE_COEFFICIENT = 1.6726e-6;

/**
 * Solar-wind ram (dynamic) pressure in nanopascals for the given proton density
 * (protons/cm^3) and bulk speed (km/s), from `Pdyn = k * n * v^2`. Non-finite or
 * negative inputs are treated as zero so a bad feed value yields `0` rather than
 * a `NaN` pressure.
 */
export const solarWindDynamicPressure = (densityCm3: number, speedKms: number): number => {
  if (!Number.isFinite(densityCm3) || !Number.isFinite(speedKms)) return 0;
  const density = Math.max(0, densityCm3);
  const speed = Math.max(0, speedKms);
  return DYNAMIC_PRESSURE_COEFFICIENT * density * speed * speed;
};

/** Reference quiet-time solar-wind dynamic pressure, in nanopascals. */
export const NOMINAL_DYNAMIC_PRESSURE_NPA = 2;

/** Subsolar magnetopause standoff distance, in Earth radii, at nominal pressure. */
export const NOMINAL_MAGNETOPAUSE_STANDOFF_RE = 10.5;

/**
 * Subsolar magnetopause standoff distance in Earth radii for the given dynamic
 * pressure (nPa). Pressure balance between the ram pressure and the compressed
 * dipole field makes the standoff scale as `Pdyn^(-1/6)`, so this anchors that
 * scaling to the nominal reference (`NOMINAL_MAGNETOPAUSE_STANDOFF_RE` at
 * `NOMINAL_DYNAMIC_PRESSURE_NPA`): higher pressure pushes the boundary inward.
 * Non-positive or non-finite pressure leaves the boundary undefined, returning
 * `Infinity` (an unopposed magnetosphere).
 */
export const magnetopauseStandoffRe = (dynamicPressureNPa: number): number => {
  if (!Number.isFinite(dynamicPressureNPa) || dynamicPressureNPa <= 0) return Infinity;
  return (
    NOMINAL_MAGNETOPAUSE_STANDOFF_RE *
    (NOMINAL_DYNAMIC_PRESSURE_NPA / dynamicPressureNPa) ** (1 / 6)
  );
};

/** Geostationary orbit radius, in Earth radii (42,164 km / 6,371 km). */
export const GEO_RADIUS_RE = 6.6;

/**
 * True when the subsolar magnetopause has been compressed to or inside
 * geostationary orbit, so a spacecraft at GEO on the dayside can cross the
 * boundary into the shocked magnetosheath and see the solar wind directly. This
 * only happens under severe ram-pressure loading and is a real operational
 * hazard flag for GEO assets.
 */
export const isMagnetopauseInsideGeo = (standoffRe: number): boolean =>
  standoffRe <= GEO_RADIUS_RE;
