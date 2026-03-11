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
import { env, hasValidCesiumIonToken } from "./utils/env";

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

  if (!hasValidCesiumIonToken(env.VITE_CESIUM_ION_TOKEN)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--aurora-bg)] p-6 text-[var(--aurora-text)]">
        <div className="max-w-xl rounded border border-red-500/60 bg-red-950/40 p-5 font-mono">
          <p className="text-sm uppercase tracking-[0.18em] text-red-300">Configuration Error</p>
          <p className="mt-2 text-sm text-red-100">
            Missing valid Cesium Ion token. Set <code className="rounded bg-black/30 px-1">VITE_CESIUM_ION_TOKEN</code> in{" "}
            <code className="rounded bg-black/30 px-1">.env</code> to a real token (not{" "}
            <code className="rounded bg-black/30 px-1">your_cesium_ion_token_here</code>).
          </p>
        </div>
      </div>
    );
  }

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
