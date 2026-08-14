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
 * Renders a live countdown to a target time at seconds resolution. Future targets
 * read as `HH:MM:SS`; past targets read as `PASSED HH:MM:SS ago`, collapsing to
 * `PASSED …d HHh ago` once more than a day has elapsed. Accepts a `Date` or ISO
 * string. Unlike {@link formatDurationToTca}, this keeps a ticking seconds field,
 * so it suits a per-second refreshed readout rather than a coarse summary.
 */
export const formatCountdown = (target: Date | string): string => {
  const targetDate = target instanceof Date ? target : new Date(target);
  const rawDiffMs = targetDate.getTime() - Date.now();
  if (rawDiffMs < 0) {
    const totalSeconds = Math.floor(Math.abs(rawDiffMs) / 1000);
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
 * Builds the ops warning-badge label for a given number of active conjunctions,
 * pluralising the noun (for example `1 ACTIVE CONJUNCTION WARNING` versus
 * `3 ACTIVE CONJUNCTION WARNINGS`). Negative counts are clamped to zero.
 */
export const formatConjunctionWarningLabel = (count: number): string => {
  const safeCount = Math.max(0, Math.trunc(count));
  return `${safeCount} ACTIVE CONJUNCTION WARNING${safeCount === 1 ? "" : "S"}`;
};

/**
 * A conjunction is treated as critical when the collision probability is at
 * least 0.005 or the miss distance is 250 m or less.
 */
export const isCriticalConjunction = (conjunction: ConjunctionWarning): boolean =>
  conjunction.probability >= 0.005 || conjunction.missDistanceM <= 250;
