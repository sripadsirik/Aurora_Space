import type { ConjunctionObjectRef, ConjunctionWarning } from "../types/space";

// Color identifies a pair; severity remains an explicit badge in the inspector.
export function conjunctionPairColor(id: string): string {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `hsl(${(hash >>> 0) % 360}, 70%, 70%)`;
}

export function orderedConjunctionPairs(conjunctions: ConjunctionWarning[]) {
  return [...conjunctions].sort((a, b) => new Date(a.tca).getTime() - new Date(b.tca).getTime() || a.id.localeCompare(b.id))
    .map((conjunction, index) => ({ conjunction, number: String(index + 1).padStart(2, "0"), color: conjunctionPairColor(conjunction.id) }));
}

export function conjunctionPairStyle(id: string, selectedId: string | null, isolate: boolean) {
  const selected = id === selectedId;
  return {
    visible: !isolate || !selectedId || selected,
    opacity: selected ? 0.98 : selectedId ? 0.07 : 0.26,
    width: selected ? 2.8 : 1,
  };
}

export function conjunctionObjectLabel(object: ConjunctionObjectRef): string {
  return !object.name || object.name.toUpperCase() === "UNKNOWN" ? `Object #${object.noradId}` : object.name;
}
