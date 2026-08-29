/**
 * Solar-wind dynamic pressure and its effect on the magnetosphere.
 *
 * The solar wind presses on Earth's magnetic field with a ram (dynamic)
 * pressure set by its proton density and bulk speed. A denser or faster stream
 * pushes harder, compressing the dayside magnetopause closer to Earth. These
 * pure helpers turn the density (protons/cm^3) and speed (km/s) already carried
 * on a space-weather snapshot into the dynamic pressure in nanopascals.
 */

/**
 * Conversion factor so that `P[nPa] = FACTOR * n[cm^-3] * v[km/s]^2`.
 *
 * Dynamic pressure is `P = rho * v^2` with mass density `rho = n * m_p`.
 * Converting the number density from cm^-3 to m^-3 (`1e6`), the speed from
 * km/s to m/s (`1e3`, squared to `1e6`), the result from pascals to nanopascals
 * (`1e9`), and using the proton mass `m_p = 1.6726e-27 kg` gives
 * `1.6726e-27 * 1e6 * 1e6 * 1e9 = 1.6726e-6`. This is the protons-only figure;
 * the few percent of alpha particles in the real stream are neglected.
 */
export const SOLAR_WIND_DYNAMIC_PRESSURE_FACTOR = 1.6726e-6;

/**
 * Solar-wind dynamic (ram) pressure in nanopascals from the proton number
 * density (protons/cm^3) and bulk speed (km/s): `P = 1.6726e-6 * n * v^2`.
 * A denser or faster stream exerts more pressure on the magnetosphere; a
 * typical quiet stream (n ~ 5, v ~ 400) sits near 1.3 nPa.
 */
export const solarWindDynamicPressureNPa = (densityCm3: number, speedKms: number): number =>
  SOLAR_WIND_DYNAMIC_PRESSURE_FACTOR * densityCm3 * speedKms * speedKms;

/**
 * Coefficient (in Earth radii) in the magnetopause standoff relation
 * `r_mp / R_E = COEFF * P[nPa]^(-1/6)`.
 *
 * It comes from Chapman-Ferraro pressure balance between the solar-wind ram
 * pressure and the compressed geomagnetic dipole field: setting
 * `P_dyn = 2 * B0^2 / mu0 * (R_E / r)^6` and solving for `r` gives
 * `COEFF = (2 * B0^2 / (mu0 * 1e-9))^(1/6) ~ 10.74` for the equatorial surface
 * field `B0 = 3.11e-5 T`. A nominal ~2 nPa stream then sits the magnetopause
 * near 9.6 R_E, matching the observed dayside standoff.
 */
export const MAGNETOPAUSE_STANDOFF_COEFFICIENT_RE = 10.74;

/**
 * Dayside magnetopause standoff distance in Earth radii for a given solar-wind
 * dynamic pressure (nPa): `r_mp = 10.74 * P^(-1/6)`. Higher pressure compresses
 * the magnetosphere, so the standoff distance shrinks. Pressures at or below
 * zero are unphysical and clamped to a tiny positive value to avoid a divide by
 * zero, so the result stays finite.
 */
export const magnetopauseStandoffRe = (pressureNPa: number): number =>
  MAGNETOPAUSE_STANDOFF_COEFFICIENT_RE * Math.pow(Math.max(pressureNPa, 1e-6), -1 / 6);

/** How hard the solar wind is pressing on the magnetosphere. */
export type SolarWindPressureLevel = "quiet" | "elevated" | "compressed";

/** Dynamic pressure (nPa) at or above which the stream reads as elevated. */
export const SOLAR_WIND_PRESSURE_ELEVATED_NPA = 3;

/** Dynamic pressure (nPa) at or above which the magnetosphere reads as compressed. */
export const SOLAR_WIND_PRESSURE_COMPRESSED_NPA = 10;

/**
 * Classifies a solar-wind dynamic pressure into a qualitative level: `quiet`
 * below 3 nPa, `elevated` from 3 up to 10 nPa, and `compressed` at or above
 * 10 nPa, where the dayside magnetosphere is being visibly squeezed.
 */
export const classifySolarWindPressure = (pressureNPa: number): SolarWindPressureLevel => {
  if (pressureNPa >= SOLAR_WIND_PRESSURE_COMPRESSED_NPA) return "compressed";
  if (pressureNPa >= SOLAR_WIND_PRESSURE_ELEVATED_NPA) return "elevated";
  return "quiet";
};

/**
 * Geostationary orbit radius in Earth radii: the 42,164 km orbit divided by the
 * WGS84 equatorial radius of 6,378 km gives roughly 6.61 R_E. When the dayside
 * magnetopause is compressed inside this distance, geostationary satellites near
 * local noon can cross into the sheath and shocked solar wind.
 */
export const GEOSTATIONARY_RADIUS_RE = 6.61;

/**
 * True when the dayside magnetopause standoff distance has been compressed to at
 * or inside geostationary orbit, exposing GEO satellites near local noon to the
 * magnetosheath. This happens only under strong dynamic-pressure enhancements.
 */
export const isGeoExposedToSolarWind = (standoffRe: number): boolean =>
  standoffRe <= GEOSTATIONARY_RADIUS_RE;
