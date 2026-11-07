import { env } from "../utils/env";
import { useUtcClock } from "../hooks/useUtcClock";
import { DataStatusIndicator } from "./DataStatusIndicator";
import { useAuroraStore } from "../store/auroraStore";
import type {
  ConjunctionWarning,
  Satellite,
  SpaceWeather,
} from "../types/space";
import { formatUtcTime } from "../utils/format";
import { formatKpIndex } from "../utils/measurements";
import { resolveDisplayedWeather } from "../utils/displayedWeather";
interface HUDProps {
  satellites: Satellite[];
  conjunctions: ConjunctionWarning[];
  spaceWeather: SpaceWeather;
}
export const HUD = ({ spaceWeather }: HUDProps): JSX.Element | null => {
  const now = useUtcClock();
  const mode = useAuroraStore((s) => s.currentMode),
    open = useAuroraStore((s) => s.openPanel);
  const received = useAuroraStore((s) => s.feedLastUpdated.spaceWeather),
    event = useAuroraStore((s) => s.timelineEvent);
  const weather = resolveDisplayedWeather(spaceWeather, event);
  const unavailable = Boolean(env.VITE_WS_URL) && !received && !event;
  if (mode !== "OPS") return null;
  return (
    <>
      <header className="mission-header">
        <div className="mission-brand">
          <span className="mission-mark" aria-hidden="true">
            ∿
          </span>
          <div>
            <h1>AURORA</h1>
            <p>AIR · EARTH · ORBIT</p>
          </div>
        </div>
        <div className="mission-status">
          <span>{formatUtcTime(now)}</span>
          <DataStatusIndicator />
        </div>
      </header>
      <button
        className="weather-summary"
        onClick={() => {
          useAuroraStore.getState().closeAllPanels();
          open("space-weather");
        }}
      >
        <span>SPACE WEATHER</span>
        <strong>
          {unavailable ? "Unavailable" : `Kp ${formatKpIndex(weather.kpIndex)}`}
        </strong>
        <span>{unavailable ? "Check sources" : weather.stormLevel} ↗</span>
      </button>
    </>
  );
};
