import { useAuroraStore } from "../../store/auroraStore";
import { conjunctionFleetSeverityColor } from "../../utils/colors";
import { classifyConjunctionFleetSeverity } from "../../utils/conjunctionRisk";
import { formatConjunctionWarningLabel } from "../../utils/format";

export const OpsWarningBadge = (): JSX.Element | null => {
  const fetched = useAuroraStore((s) => s.feedLastUpdated.conjunctions);
  const currentMode = useAuroraStore((s) => s.currentMode);
  const conjunctions = useAuroraStore((s) => s.conjunctions);
  const openPanel = useAuroraStore((s) => s.openPanel);
  const activePanels = useAuroraStore((s) => s.activePanels);

  if (currentMode !== "OPS") return null;

  const activeCount = conjunctions.length;
  const badgeColor = activeCount ? conjunctionFleetSeverityColor(classifyConjunctionFleetSeverity(conjunctions)) : fetched ? "#9cc2de" : "#e5bf7b";
  const isOpen = activePanels.has("active-conjunctions");


  return (
    <div className="pointer-events-auto fixed left-1/2 top-4 z-[70] -translate-x-1/2">
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            useAuroraStore.getState().closePanel("active-conjunctions");
          } else {
            openPanel("active-conjunctions");
          }
        }}
        className="rounded border px-4 py-2 font-mono text-[12px] tracking-[0.15em] transition-all hover:scale-105"
        style={{
          borderColor: `${badgeColor}80`,
          backgroundColor: `${badgeColor}18`,
          color: badgeColor,
          textShadow: `0 0 10px ${badgeColor}60`,
          animation: "storm-pulse 3s ease-in-out infinite"
        }}
      >
        {activeCount ? formatConjunctionWarningLabel(activeCount) : fetched ? "NO UPCOMING PUBLIC CDMs" : "CONJUNCTION FEED UNAVAILABLE"}
      </button>
    </div>
  );
};
