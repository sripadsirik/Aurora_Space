import { useEffect } from "react";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { GlobeView } from "./components/GlobeView";
import { HUD } from "./components/HUD";
import { ModeSelector } from "./components/ModeSelector";
import { Timeline } from "./components/Timeline";
import { useWebSocket } from "./hooks/useWebSocket";
import { HelioOverlay } from "./components/overlays/HelioOverlay";
import { IntelOverlay } from "./components/overlays/IntelOverlay";
import { StormOverlay } from "./components/overlays/StormOverlay";
import { ActiveConjunctionsPanel } from "./components/panels/ActiveConjunctionsPanel";
import { CmeLibraryPanel } from "./components/panels/CmeLibraryPanel";
import { IntelAnalysisPanel } from "./components/panels/IntelAnalysisPanel";
import { OpsWarningBadge } from "./components/panels/OpsWarningBadge";
import { PanelManager } from "./components/panels/PanelManager";
import { StormImpactPanel } from "./components/panels/StormImpactPanel";
import { useAuroraStore } from "./store/auroraStore";
import { SceneControls } from "./components/scene/SceneControls";

export const App = (): JSX.Element => {
  useWebSocket();
  const satellites = useAuroraStore((state) => state.satellites);
  const conjunctions = useAuroraStore((state) => state.conjunctions);
  const spaceWeather = useAuroraStore((state) => state.spaceWeather);
  const currentMode = useAuroraStore((state) => state.currentMode);
  const earthOnlyMode = useAuroraStore((state) => state.earthOnlyMode);
  const toggleEarthOnlyMode = useAuroraStore((state) => state.toggleEarthOnlyMode);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        toggleEarthOnlyMode();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleEarthOnlyMode]);


  return (
    <ErrorBoundary>
      <div className="relative h-screen w-screen overflow-hidden bg-[var(--aurora-bg)]">
        <div className="h-full w-full transition-opacity duration-400">
          <GlobeView
            satellites={satellites}
            conjunctions={conjunctions}
            spaceWeather={spaceWeather}
          />
        </div>

        <SceneControls />

        {!earthOnlyMode && (
          <>
            <StormOverlay />
            <IntelOverlay />
            <HelioOverlay />

            <HUD
              satellites={satellites}
              conjunctions={conjunctions}
              spaceWeather={spaceWeather}
            />

            {currentMode !== "HELIO" && <PanelManager />}

            <OpsWarningBadge />
            <ActiveConjunctionsPanel />
            <StormImpactPanel />
            <IntelAnalysisPanel />
            <CmeLibraryPanel />

            <ModeSelector />
            <Timeline />
          </>
        )}
      </div>
    </ErrorBoundary>
  );
};
