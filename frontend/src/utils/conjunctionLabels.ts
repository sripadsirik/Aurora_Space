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

/**
 * Returns the name of the conjunction participant that is *not* the given
 * satellite — the object it is closing with. Matching is by NORAD id, so when
 * the satellite is `object1` the peer is `object2` and vice versa. If the
 * satellite is not `object1`, `object2` is treated as the peer, which also
 * yields a sensible label when the satellite is not part of the pair.
 */
export const conjunctionPeerName = (
  satellite: Pick<Satellite, "noradId">,
  conjunction: Pick<ConjunctionWarning, "object1" | "object2">
): string =>
  conjunction.object1.noradId === satellite.noradId ? conjunction.object2.name : conjunction.object1.name;
