/**
 * Display formatters for the physical measurements shown across the HUD,
 * overlays, and panels — Kp index, magnetic field, altitude, and speed. Several
 * components independently rendered these with inline `toFixed` calls, which
 * both duplicated the precision and unit choices and let a bad feed value show
 * as `NaN`. Centralising them here gives each quantity a single tested
 * definition and, following {@link formatMissDistance}, renders a non-finite
 * input as an em dash rather than `NaN`.
 */

const EM_DASH = "—";

/**
 * Formats a Kp geomagnetic index to one decimal place (for example `5.3`). The
 * caller supplies any `Kp ` prefix. A non-finite value renders as an em dash so
 * a missing feed reading never shows as `NaN`.
 */
export const formatKpIndex = (kp: number): string =>
  Number.isFinite(kp) ? kp.toFixed(1) : EM_DASH;

/**
 * Formats a magnetic-field strength in nanotesla to one decimal place with its
 * unit (for example `-5.2 nT`), used for the interplanetary Bz component. The
 * sign is preserved so a southward (negative) field reads clearly. A non-finite
 * value renders as an em dash.
 */
export const formatMagneticFieldNt = (nanotesla: number): string =>
  Number.isFinite(nanotesla) ? `${nanotesla.toFixed(1)} nT` : EM_DASH;

/**
 * Formats an altitude in kilometres to one decimal place with its unit (for
 * example `412.5 km`), used for the selected-satellite readout. A non-finite
 * value renders as an em dash.
 */
export const formatAltitudeKm = (km: number): string =>
  Number.isFinite(km) ? `${km.toFixed(1)} km` : EM_DASH;

/**
 * Formats a speed in kilometres per second with its unit (for example
 * `7.123 km/s`). The number of fraction digits is configurable because the
 * orbital-velocity and relative-velocity readouts display different precision;
 * it defaults to one. A non-finite value renders as an em dash.
 */
export const formatSpeedKms = (kms: number, fractionDigits = 1): string =>
  Number.isFinite(kms) ? `${kms.toFixed(fractionDigits)} km/s` : EM_DASH;
