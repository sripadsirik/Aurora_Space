import type { MockCME } from "../types/space";

/**
 * Whether a modelled CME cleanly misses Earth rather than striking it. Wraps the
 * `NO IMPACT — MISS` status string so callers never re-type the magic value and
 * the em-dash spelling lives in one place.
 */
export const isCmeMiss = (cme: Pick<MockCME, "impactStatus">): boolean =>
  cme.impactStatus === "NO IMPACT — MISS";

/**
 * Whether a CME has already reached Earth orbit, i.e. its countdown to arrival
 * has run down to zero or gone negative. Centralises the `hoursUntilArrival <= 0`
 * check so the "arrived" boundary is defined once.
 */
export const hasCmeArrived = (cme: Pick<MockCME, "hoursUntilArrival">): boolean =>
  cme.hoursUntilArrival <= 0;

/**
 * Builds the single-line arrival status shown on a CME card. The wording depends
 * on the modelled impact geometry:
 *
 * - A clean miss reads `PASSES EARTH ORBIT IN <h>h — NO IMPACT`.
 * - An already-arrived CME (`hoursUntilArrival <= 0`) reads `ARRIVED <h>h ago`.
 * - A pending glancing blow is prefixed with `GLANCING ARRIVAL — `; a pending
 *   direct hit has no prefix. Both end in `<h>h until arrival`.
 */
export const formatCmeArrival = (cme: Pick<MockCME, "impactStatus" | "hoursUntilArrival">): string => {
  if (isCmeMiss(cme)) {
    return `PASSES EARTH ORBIT IN ${cme.hoursUntilArrival}h — NO IMPACT`;
  }
  if (hasCmeArrived(cme)) {
    return `ARRIVED ${Math.abs(cme.hoursUntilArrival)}h ago`;
  }
  const prefix = cme.impactStatus === "GLANCING BLOW" ? "GLANCING ARRIVAL — " : "";
  return `${prefix}${cme.hoursUntilArrival}h until arrival`;
};

/**
 * Tailwind text-colour utility class for a CME card's arrival readout. An
 * already-arrived CME reads in an alert red-orange; a clean miss reads in a calm
 * green; a pending impact reads in a warning amber. The arrived state takes
 * precedence over the miss state, matching the card's visual ordering.
 */
export const cmeArrivalTextClass = (
  cme: Pick<MockCME, "impactStatus" | "hoursUntilArrival">
): string => {
  if (hasCmeArrived(cme)) return "text-[#ff6644]";
  if (isCmeMiss(cme)) return "text-[#7dff6a]";
  return "text-[#ffcc88]";
};

/**
 * Lists the primary operational impacts to surface for an impacting CME, in
 * escalating order of severity. HF radio and GPS effects are always present;
 * a predicted Kp of 7+ adds power-grid stress, and Kp 8+ adds satellite
 * charging risk. Order is significant — callers render the list top to bottom.
 */
export const cmePrimaryImpacts = (cme: Pick<MockCME, "predictedKp">): string[] => {
  const impacts = ["HF Radio degradation", "GPS accuracy reduction"];
  if (cme.predictedKp >= 7) impacts.push("Power grid stress");
  if (cme.predictedKp >= 8) impacts.push("Satellite charging risk");
  return impacts;
};
