import { useEffect, useState } from "react";
import { useAuroraStore } from "../../store/auroraStore";
import { useSceneStore, type SceneQuality } from "../../store/sceneStore";
import { elementEpoch, hasCurrentElements } from "../../utils/propagation";
import { env, hasValidCesiumIonToken } from "../../utils/env";

export const SceneControls = (): JSX.Element => {
  const [open, setOpen] = useState(false);
  const scene = useSceneStore();
  const selected = useAuroraStore((s) => s.selectedSatellite);
  const earthOnly = useAuroraStore((s) => s.earthOnlyMode);
  const mode = useAuroraStore((s) => s.currentMode);
  const toggleEarth = useAuroraStore((s) => s.toggleEarthOnlyMode);
  const live = useAuroraStore((s) => s.feedLastUpdated.satellites !== null);
  const earthView = mode !== "HELIO" || earthOnly;

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest("input, textarea, select"))) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "h") scene.requestCamera("home");
      if (event.key.toLowerCase() === "f" && selected && earthView && !earthOnly) scene.setFollowing(!scene.following);
      if (event.key.toLowerCase() === "v") setOpen((value) => !value);
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scene, selected, earthView, earthOnly]);

  return (
    <div className={`scene-controls ${earthOnly ? "scene-controls--immersive" : ""}`}>
      {open && (
        <section className="scene-settings" aria-label="3D view settings">
          <div className="scene-settings-heading"><div><span className="scene-eyebrow">MAKE IT YOURS</span><h2>View controls</h2></div><button className="scene-icon-button" onClick={() => setOpen(false)} aria-label="Close view settings">×</button></div>
          <label className="scene-field" htmlFor="scene-quality">Graphics quality</label>
          <div className="scene-segmented" id="scene-quality" role="group" aria-label="Graphics quality">
            {(["performance", "balanced", "cinematic"] as SceneQuality[]).map((quality) => <button key={quality} aria-pressed={scene.quality === quality} onClick={() => scene.setQuality(quality)}>{quality === "performance" ? "Smooth" : quality === "balanced" ? "Balanced" : "Cinema"}</button>)}
          </div>
          <p className="scene-note">{scene.quality === "cinematic" ? "Sharper Earth, atmospheric light and a subtle bloom." : scene.quality === "performance" ? "Lower resolution and fewer effects for lighter devices." : "A crisp globe with a comfortable rendering budget."}</p>
          {earthView && <>
            <span className="scene-field">Camera destinations</span>
            <div className="scene-segmented" role="group" aria-label="Camera destinations">
              <button onClick={() => scene.requestCamera("home")}>Earth</button><button onClick={() => scene.requestCamera("terminator")}>Night edge</button><button onClick={() => scene.requestCamera("polar")}>North pole</button>
            </div>
            <div className="scene-toggles">
              {([['lighting', 'Day / night lighting'], ['orbitPaths', 'Selected SGP4 orbit path'], ['coverage', 'Selected satellite footprint'], ['spaceWeather', 'Space weather overlays'], ['autoRotate', 'Slow camera rotation']] as const).map(([key, label]) => (
                <label key={key} className="scene-toggle"><span>{label}</span><input type="checkbox" checked={scene[key]} disabled={(key === 'autoRotate' && scene.following)} onChange={() => scene.toggle(key)} /><span className="scene-switch" aria-hidden="true" /></label>
              ))}
            </div>
          </>}
          <p className="scene-note">{hasValidCesiumIonToken(env.VITE_CESIUM_ION_TOKEN) ? "Cesium terrain and imagery enabled; the bundled Earth map is the fallback." : "Bundled Earth imagery. Add a Cesium ion token for detailed terrain and buildings."}</p>
          <div className="scene-shortcuts"><span>Drag to orbit</span><span>Scroll to zoom</span><span>Right-drag to tilt</span><span><kbd>H</kbd> Home · <kbd>V</kbd> View · <kbd>0</kbd> Immerse</span></div>
        </section>
      )}
      <div className="scene-toolbar" role="toolbar" aria-label="Globe controls">
        <button className="scene-tool scene-view-button" aria-expanded={open} onClick={() => setOpen(!open)} title="View controls (V)"><span aria-hidden="true">◈</span> View</button>
        <span className="scene-divider" />
        <button className="scene-tool" onClick={() => scene.requestCamera("home")} title="Reset camera (H)" aria-label="Reset camera">⌂</button>
        <button className="scene-tool" onClick={() => scene.requestCamera("zoom-in")} title="Zoom in" aria-label="Zoom in">+</button>
        <button className="scene-tool" onClick={() => scene.requestCamera("zoom-out")} title="Zoom out" aria-label="Zoom out">−</button>
        <span className="scene-divider" />
        <button className="scene-tool scene-immerse-button" aria-pressed={earthOnly} onClick={toggleEarth} title="Immersive Earth (0)">{earthOnly ? "Exit immersive" : "Immerse"}</button>
      </div>
      {selected && earthView && !earthOnly && <div className="scene-selection"><div><span className="scene-eyebrow">{live ? (hasCurrentElements(selected) ? "SGP4 · REAL ORBITAL ELEMENTS" : "SNAPSHOT · NO CURRENT TLE") : "DEMO · SIMULATED"}</span><strong>{selected.name}</strong><span>{Math.round(selected.altitudeKm).toLocaleString()} km · {selected.orbitType}</span><span>Representative model · illustrative attitude & size</span><span>{elementEpoch(selected) ? `TLE epoch ${elementEpoch(selected)!.toUTCString()}` : "No TLE: predicted path unavailable"}</span></div><button className="scene-follow" aria-pressed={scene.following} onClick={() => scene.setFollowing(!scene.following)}>{scene.following ? "Following ●" : "Follow ↗"}</button></div>}
    </div>
  );
};
