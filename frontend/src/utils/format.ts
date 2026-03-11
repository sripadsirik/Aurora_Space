import type { ConjunctionWarning } from "../types/space";

const pad = (value: number): string => value.toString().padStart(2, "0");

export const formatUtcTime = (date: Date): string =>
  `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;

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

export const formatProbability = (probability: number): string => probability.toExponential(1);

export const isCriticalConjunction = (conjunction: ConjunctionWarning): boolean =>
  conjunction.probability >= 0.005 || conjunction.missDistanceM <= 250;
