/**
 * Presentation helpers for coronal mass ejection (CME) cards.
 *
 * The HELIO-mode CME library renders each modelled ejection as a card whose
 * wording, badges, and accent colours all follow from the CME's impact geometry
 * (a clean miss, a glancing blow, or a direct hit) and how long until it reaches
 * Earth. Deriving those display strings in one tested place keeps the cards
 * consistent and keeps the panel component free of scattered impact-status
 * conditionals.
 */

import type { CmeImpactStatus, MockCME } from "../types/space";

/**
 * The {@link CmeImpactStatus} value marking a CME that passes Earth's orbit
 * without striking the magnetosphere. Shared so the "clean miss" branch reads
 * the same in every helper instead of repeating the literal string.
 */
export const CME_MISS_STATUS: CmeImpactStatus = "NO IMPACT — MISS";

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
  if (cme.impactStatus === CME_MISS_STATUS) {
    return `PASSES EARTH ORBIT IN ${cme.hoursUntilArrival}h — NO IMPACT`;
  }
  if (cme.hoursUntilArrival <= 0) {
    return `ARRIVED ${Math.abs(cme.hoursUntilArrival)}h ago`;
  }
  const prefix = cme.impactStatus === "GLANCING BLOW" ? "GLANCING ARRIVAL — " : "";
  return `${prefix}${cme.hoursUntilArrival}h until arrival`;
};

/**
 * True when a CME cleanly misses Earth's orbit ({@link CME_MISS_STATUS}), so a
 * card can drop the storm badge, arrival countdown, and impact list in favour of
 * the calmer "miss" styling.
 */
export const isCmeMiss = (cme: Pick<MockCME, "impactStatus">): boolean =>
  cme.impactStatus === CME_MISS_STATUS;

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
