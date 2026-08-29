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
