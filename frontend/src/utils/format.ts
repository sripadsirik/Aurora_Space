import type { ConjunctionWarning } from "../types/space";

const pad = (value: number): string => value.toString().padStart(2, "0");

export const formatUtcTime = (date: Date): string =>
  `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;

export const formatDurationToTca = (tca: Date): string => {
  const diffMs = Math.max(0, tca.getTime() - Date.now());
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

export const formatProbability = (probability: number): string => probability.toExponential(1);

export const isCriticalConjunction = (conjunction: ConjunctionWarning): boolean =>
  conjunction.probability >= 0.005 || conjunction.missDistanceM <= 250;
