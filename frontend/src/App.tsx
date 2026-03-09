import { GlobeView } from "./components/GlobeView";
import { HUD } from "./components/HUD";
import { PanelManager } from "./components/panels/PanelManager";
import { useAuroraStore } from "./store/auroraStore";
import { env, hasValidCesiumIonToken } from "./utils/env";

export const App = (): JSX.Element => {
  const satellites = useAuroraStore((state) => state.satellites);
  const conjunctions = useAuroraStore((state) => state.conjunctions);
  const spaceWeather = useAuroraStore((state) => state.spaceWeather);

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
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--aurora-bg)]">
      <GlobeView
        satellites={satellites}
        conjunctions={conjunctions}
        spaceWeather={spaceWeather}
      />
      <HUD
        satellites={satellites}
        conjunctions={conjunctions}
        spaceWeather={spaceWeather}
      />
      <PanelManager />
    </div>
  );
};
