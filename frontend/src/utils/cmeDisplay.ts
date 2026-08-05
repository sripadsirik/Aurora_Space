import type { MockCME } from "../types/space";

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
  if (cme.impactStatus === "NO IMPACT — MISS") {
    return `PASSES EARTH ORBIT IN ${cme.hoursUntilArrival}h — NO IMPACT`;
  }
  if (cme.hoursUntilArrival <= 0) {
    return `ARRIVED ${Math.abs(cme.hoursUntilArrival)}h ago`;
  }
  const prefix = cme.impactStatus === "GLANCING BLOW" ? "GLANCING ARRIVAL — " : "";
  return `${prefix}${cme.hoursUntilArrival}h until arrival`;
};
