import { EarthPanel } from "./earth/EarthPanel";
import { Explorer } from "./explorer/Explorer";
import { AerospacePanel } from "./aerospace/AerospacePanel";
import { useMissionStore } from "./mission/store";
import { MissionControl, MissionLauncher } from "./components/mission/MissionControl";
import { useEffect } from "react";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { GlobeView } from "./components/GlobeView";
import { HUD } from "./components/HUD";
import { ModeSelector } from "./components/ModeSelector";
import { Timeline } from "./components/Timeline";
import { useWebSocket } from "./hooks/useWebSocket";
import { IntelOverlay } from "./components/overlays/IntelOverlay";
import { StormOverlay } from "./components/overlays/StormOverlay";
import { ActiveConjunctionsPanel } from "./components/panels/ActiveConjunctionsPanel";
import { IntelAnalysisPanel } from "./components/panels/IntelAnalysisPanel";
import { OpsWarningBadge } from "./components/panels/OpsWarningBadge";
import { PanelManager } from "./components/panels/PanelManager";
import { StormImpactPanel } from "./components/panels/StormImpactPanel";
import { useAuroraStore } from "./store/auroraStore";
import { SatelliteWorkbench } from "./components/panels/SatelliteWorkbench";
import { ModeHeading } from "./components/overlays/ModeHeading";

import { SceneControls } from "./components/scene/SceneControls";
import { useAerospace } from "./aerospace/store";
import { useEarth } from "./earth/store";
import { useExplorer } from "./explorer/store";
import { illinoisPlaces } from "./earth/cameraNetworks";

export const App = (): JSX.Element => {
  useWebSocket();
  const missionOpen = useMissionStore(s => s.open);
  const satellites = useAuroraStore((state) => state.satellites);
  const conjunctions = useAuroraStore((state) => state.conjunctions);
  const spaceWeather = useAuroraStore((state) => state.spaceWeather);
  const currentMode = useAuroraStore((state) => state.currentMode);
  const earthOnlyMode = useAuroraStore((state) => state.earthOnlyMode);
  const toggleEarthOnlyMode = useAuroraStore((state) => state.toggleEarthOnlyMode);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const launchId = params.get("launch");
    if (launchId && /^[A-Za-z0-9_-]{1,80}$/.test(launchId)) {
      useAerospace.getState().set({
        open: true,
        tab: "launches",
        launchesOn: true,
        selected: "launch:" + launchId,
        followedLaunchId: launchId,
        launchCameraFollow: true,
        aircraftFollow: false,
        simulation: null,
      });
    }
    if (["all", "singapore", "illinois", "california", "london", "finland", "nsw"].includes(params.get("cameras") || "")) {
      useEarth.getState().set({ camerasOn: true, cameraNetwork: params.get("cameras")!, cameraArea: params.get("area") || "" });
      useExplorer.getState().set({ earthOpen: !launchId });
      const place = illinoisPlaces.find(p => p.id === params.get("area"));
      if (place && !launchId) useEarth.getState().locate(place.lat, place.lon, place.name);
    }
  }, []);

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


  if (missionOpen) return <ErrorBoundary><MissionControl /></ErrorBoundary>;

  return (
    <ErrorBoundary>
      <div data-mode={currentMode} className="relative h-screen w-screen overflow-hidden bg-[var(--aurora-bg)]">
        <div className="h-full w-full transition-opacity duration-400">
          <GlobeView
            satellites={satellites}
            conjunctions={conjunctions}
            spaceWeather={spaceWeather}
          />
        </div>

        <SceneControls />
        <AerospacePanel />
        <Explorer />
        <EarthPanel />
        <MissionLauncher />
        <MissionControl />

        {!earthOnlyMode && (
          <>
            <ModeHeading />
            <StormOverlay />
            <IntelOverlay />

            <HUD
              satellites={satellites}
              conjunctions={conjunctions}
              spaceWeather={spaceWeather}
            />

            {currentMode === "OPS" && <PanelManager />}
            <SatelliteWorkbench />


            <OpsWarningBadge />
            <ActiveConjunctionsPanel />
            <StormImpactPanel />
            <IntelAnalysisPanel />

            <ModeSelector />
            <Timeline />
          </>
        )}
      </div>
    </ErrorBoundary>
  );
};
