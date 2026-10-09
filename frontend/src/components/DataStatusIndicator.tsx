import { useUtcClock } from "../hooks/useUtcClock";
import { useAuroraStore } from "../store/auroraStore";
import { getDataStatus } from "../utils/dataStatus";

const statusColor = {
  demo: "border-amber-400/50 bg-amber-950/70 text-amber-200",
  mixed: "border-amber-400/50 bg-amber-950/70 text-amber-200",
  live: "border-emerald-400/50 bg-emerald-950/70 text-emerald-200",
  stale: "border-orange-400/50 bg-orange-950/70 text-orange-200",
  offline: "border-red-400/50 bg-red-950/70 text-red-200"
} as const;

export const DataStatusIndicator = (): JSX.Element => {
  const now = useUtcClock();
  const connected = useAuroraStore((state) => state.isConnectedToBackend);
  const feedLastUpdated = useAuroraStore((state) => state.feedLastUpdated);
  const { status, label, detail } = getDataStatus(connected, feedLastUpdated, now);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] tracking-[0.12em] ${statusColor[status]}`}
      title={detail}
      aria-label={`${label}: ${detail}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
};
