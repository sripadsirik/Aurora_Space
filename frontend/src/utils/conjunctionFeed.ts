import type { Conjunction } from "../types/space";

/** A cached or disconnected feed cannot keep an encounter active past its TCA. */
export function currentConjunctions(events: Conjunction[], now = new Date()): Conjunction[] {
  return events.filter((event) => {
    const tca = event.tca.getTime();
    const created = event.createdAt ? new Date(event.createdAt).getTime() : NaN;
    return tca > now.getTime() && tca <= now.getTime() + 7 * 86400000 &&
      Number.isFinite(created) && created >= now.getTime() - 72 * 3600000 && created <= now.getTime() + 300000;
  });
}
