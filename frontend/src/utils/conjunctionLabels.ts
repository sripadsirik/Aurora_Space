import type { ConjunctionWarning, Satellite } from "../types/space";

/**
 * Builds the two-object label for a conjunction, joining the participants' names
 * with `separator` (default `x`, as the conjunction tables render it). Passing a
 * different separator — for example `-` — lets the same label read naturally in
 * prose contexts such as the HUD ticker.
 */
export const formatConjunctionPairLabel = (
  conjunction: Pick<ConjunctionWarning, "object1" | "object2">,
  separator = "x"
): string => `${conjunction.object1.name} ${separator} ${conjunction.object2.name}`;
