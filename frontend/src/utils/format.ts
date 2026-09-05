import type { ConjunctionWarning } from "../types/space";

const pad = (value: number): string => value.toString().padStart(2, "0");

/** Formats a date as a zero-padded `HH:MM:SS UTC` wall-clock string. */
export const formatUtcTime = (date: Date): string =>
  `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;

/**
 * Renders the time until (or since) a time of closest approach. Future TCAs
 * count down as `Hh Mm`; past TCAs read as `PASSED …ago`, switching to days and
 * hours once more than a day has elapsed. Accepts a `Date` or ISO string.
 */
export const formatDurationToTca = (tca: Date | string): string => {
  const tcaDate = tca instanceof Date ? tca : new Date(tca);
  const rawDiffMs = tcaDate.getTime() - Date.now();
  if (rawDiffMs < 0) {
    const elapsed = Math.abs(rawDiffMs);
    const totalMinutes = Math.floor(elapsed / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    if (days > 0) return `PASSED ${days}d ${hours}h ago`;
    const minutes = totalMinutes % 60;
    return `PASSED ${hours}h ${minutes}m ago`;
  }
  const totalMinutes = Math.floor(rawDiffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

/**
 * Renders a high-resolution countdown to a time of closest approach. Future TCAs
 * read as a zero-padded `HH:MM:SS` clock; past TCAs read as `PASSED …ago`,
 * switching from `HH:MM:SS` to `Dd HHh` once more than a day has elapsed. Accepts
 * a `Date` or ISO string. Unlike {@link formatDurationToTca} this keeps
 * second-level precision, so it suits a live-ticking detail readout.
 */
export const formatCountdownToTca = (tca: Date | string): string => {
  const tcaDate = tca instanceof Date ? tca : new Date(tca);
  const rawDiffMs = tcaDate.getTime() - Date.now();
  if (rawDiffMs < 0) {
    const elapsed = Math.abs(rawDiffMs);
    const totalSeconds = Math.floor(elapsed / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `PASSED ${days}d ${pad(hours)}h ago`;
    return `PASSED ${pad(hours)}:${pad(minutes)}:${pad(seconds)} ago`;
  }
  const totalSeconds = Math.floor(rawDiffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

/** Formats a collision probability in exponential notation with one fraction digit. */
export const formatProbability = (probability: number): string => probability.toExponential(1);

/**
 * Formats a conjunction miss distance for display. Distances below 10 km are
 * shown in whole metres with thousands separators (for example `8,500 m`);
 * larger distances switch to kilometres with one fraction digit (for example
 * `12.5 km`) to keep the figure compact. Negative or non-finite inputs render
 * as an em dash so a bad feed value never shows as `NaN m`.
 */
export const formatMissDistance = (meters: number): string => {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters < 10000) return `${Math.round(meters).toLocaleString("en-US")} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

/**
 * Renders the rough maneuver delta-V the intel table shows for a conjunction. It
 * is a first-order display estimate that scales linearly with collision
 * probability (`probability × 10000` m/s) and is prefixed with `~` and rounded to
 * one decimal to signal that it is indicative rather than a computed burn.
 */
export const formatManeuverDeltaV = (probability: number): string =>
  `~${(probability * 10000).toFixed(1)} m/s`;

/**
 * Formats an orbital period given in minutes as a compact wall-clock string.
 * Periods under an hour read as whole minutes (for example `45m`); longer
 * periods read as hours and minutes (for example `23h 56m`). Negative inputs
 * are clamped to zero.
 */
export const formatOrbitalPeriod = (periodMinutes: number): string => {
  const totalMinutes = Math.max(0, Math.round(periodMinutes));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

/**
 * Formats an orbital speed given in km/s for display, such as a circular or
 * escape velocity. Renders two fraction digits with a `km/s` suffix (for example
 * `7.66 km/s`). Negative or non-finite inputs render as an em dash so a bad
 * value never shows as `NaN km/s`.
 */
export const formatOrbitalSpeed = (speedKms: number): string => {
  if (!Number.isFinite(speedKms) || speedKms < 0) return "—";
  return `${speedKms.toFixed(2)} km/s`;
};

/**
 * Formats a specific orbital energy given in MJ/kg for display. Renders one
 * fraction digit with a `MJ/kg` suffix (for example `-29.3 MJ/kg`); the sign is
 * preserved so a bound orbit reads as negative. Non-finite inputs render as an
 * em dash so a bad value never shows as `NaN MJ/kg`.
 */
export const formatSpecificEnergy = (energyMJ: number): string => {
  if (!Number.isFinite(energyMJ)) return "—";
  return `${energyMJ.toFixed(1)} MJ/kg`;
};

/**
 * Formats a peak >=10 MeV proton flux (in particle flux units, pfu) for display.
 * Values render with thousands separators and a `pfu` suffix (for example
 * `1,200 pfu`); fractional inputs are rounded to whole particles. Negative or
 * non-finite inputs render as an em dash so a bad feed value never shows as
 * `NaN pfu`.
 */
export const formatProtonFlux = (fluxPfu: number): string => {
  if (!Number.isFinite(fluxPfu) || fluxPfu < 0) return "—";
  return `${Math.round(fluxPfu).toLocaleString("en-US")} pfu`;
};

/**
 * Formats a satellite pass (ground-station contact) duration given in seconds as
 * a compact string. Durations under a minute read as whole seconds (for example
 * `45s`); durations under an hour read as minutes and seconds (for example
 * `8m 42s`); an hour or longer reads as hours and minutes (for example `1h 5m`).
 * Negative or non-finite inputs are clamped to `0s`.
 */
export const formatPassDuration = (seconds: number): string => {
  const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}m ${pad(totalSeconds % 60)}s`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

/**
 * Renders an orbit fraction (0-1), such as an eclipse or sunlight fraction, as a
 * whole-percent string like `37%`. Values are clamped to the 0-1 range before
 * rounding, so out-of-range inputs read as `0%` or `100%`.
 */
export const formatEclipseFraction = (fraction: number): string => {
  const clamped = Math.min(1, Math.max(0, fraction));
  return `${Math.round(clamped * 100)}%`;
};

/**
 * Builds the ops warning-badge label for a given number of active conjunctions,
 * pluralising the noun (for example `1 ACTIVE CONJUNCTION WARNING` versus
 * `3 ACTIVE CONJUNCTION WARNINGS`). Negative counts are clamped to zero.
 */
export const formatConjunctionWarningLabel = (count: number): string => {
  const safeCount = Math.max(0, Math.trunc(count));
  return `${safeCount} ACTIVE CONJUNCTION WARNING${safeCount === 1 ? "" : "S"}`;
};

/**
 * Formats a solar-wind dynamic (ram) pressure in nanopascals for display.
 * Renders two fraction digits with a `nPa` suffix (for example `1.34 nPa`).
 * Negative or non-finite inputs render as an em dash so a bad feed value never
 * shows as `NaN nPa`.
 */
export const formatDynamicPressure = (pressureNPa: number): string => {
  if (!Number.isFinite(pressureNPa) || pressureNPa < 0) return "—";
  return `${pressureNPa.toFixed(2)} nPa`;
};

/**
 * Formats a magnetopause standoff distance given in Earth radii for display.
 * Renders one fraction digit with an `Rₑ` suffix (for example `10.5 Rₑ`).
 * Negative or non-finite inputs — including the infinite standoff of an
 * unopposed magnetosphere — render as an em dash rather than `Infinity Rₑ`.
 */
export const formatMagnetopauseStandoff = (standoffRe: number): string => {
  if (!Number.isFinite(standoffRe) || standoffRe < 0) return "—";
  return `${standoffRe.toFixed(1)} Rₑ`;
};

/**
 * Formats an interplanetary electric field in millivolts per metre for display.
 * Renders two fraction digits with a `mV/m` suffix (for example `2.10 mV/m`).
 * Negative or non-finite inputs render as an em dash so a bad feed value never
 * shows as `NaN mV/m`.
 */
export const formatElectricField = (fieldMvM: number): string => {
  if (!Number.isFinite(fieldMvM) || fieldMvM < 0) return "—";
  return `${fieldMvM.toFixed(2)} mV/m`;
};

/**
 * A conjunction is treated as critical when the collision probability is at
 * least 0.005 or the miss distance is 250 m or less.
 */
export const isCriticalConjunction = (conjunction: ConjunctionWarning): boolean =>
  conjunction.probability >= 0.005 || conjunction.missDistanceM <= 250;
