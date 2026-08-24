/**
 * Solar-wind bulk-speed semantics for the space-weather readouts.
 *
 * The ambient solar wind averages a little under 450 km/s; readings at or above
 * that mark an elevated (fast) stream, which the panels flag with an up arrow
 * and a warmer colour. Centralising the threshold keeps the arrow glyph and its
 * colour in sync across views.
 */

/** Solar-wind speed (km/s) at or above which the stream reads as elevated. */
export const ELEVATED_SOLAR_WIND_KMS = 450;

/** True when the solar-wind bulk speed is at or above the elevated threshold. */
export const isElevatedSolarWind = (speedKms: number): boolean =>
  speedKms >= ELEVATED_SOLAR_WIND_KMS;

/**
 * Arrow glyph the readouts show next to a solar-wind speed: an up arrow when the
 * stream is elevated, a down arrow when it is at or below the ambient level.
 */
export const solarWindSpeedArrow = (speedKms: number): "↑" | "↓" =>
  isElevatedSolarWind(speedKms) ? "↑" : "↓";
