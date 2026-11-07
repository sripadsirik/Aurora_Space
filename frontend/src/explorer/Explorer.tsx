import { useEffect, useState } from "react";
import { useExplorer } from "./store";
import { detachAerospaceCamera, useAerospace } from "../aerospace/store";
import { useAuroraStore } from "../store/auroraStore";
import { useSceneStore } from "../store/sceneStore";
export function Explorer() {
  const ui = useExplorer(),
    air = useAerospace();
  const [layersOpen, setLayersOpen] = useState(false);
  const scene = useSceneStore();
  const mode = useAuroraStore((s) => s.currentMode);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLayersOpen(false);
        ui.set({
          catalogOpen: false,
          earthOpen: false,
          choices: [],
          hover: null,
        });
        useAerospace.getState().set({ open: false });
      }
    };
    const a = useAerospace.subscribe((s, p) => {
      if (s.open && !p.open) {
        useExplorer.getState().set({ catalogOpen: false, earthOpen: false });
        useAuroraStore.getState().closeAllPanels();
      }
    });
    const b = useAuroraStore.subscribe((s, p) => {
      if (s.activePanels !== p.activePanels && s.activePanels.size) {
        useAerospace.getState().set({ open: false });
        useExplorer.getState().set({ catalogOpen: false, earthOpen: false });
      }
    });
    window.addEventListener("keydown", close);
    return () => {
      a();
      b();
      window.removeEventListener("keydown", close);
    };
  }, []);
  if (mode !== "OPS") return null;
  const open = (tab: "catalog" | "aircraft" | "launches" | "earth") => {
    detachAerospaceCamera();
    useSceneStore.getState().setFollowing(false);
    useAuroraStore.getState().closeAllPanels();
    ui.set({
      choices: [],
      catalogOpen: tab === "catalog" ? !ui.catalogOpen : false,
      earthOpen: tab === "earth" ? !ui.earthOpen : false,
    });
    air.set({
      open:
        (tab === "aircraft" || tab === "launches") &&
        !(air.open && air.tab === tab),
      ...(tab === "aircraft" || tab === "launches" ? { tab } : {}),
    });
    if (tab === "catalog") useSceneStore.getState().setOpsPanel("catalog");
  };
  return (
    <>
      <nav className="explorer-nav" aria-label="Explore objects">
        <button aria-pressed={ui.catalogOpen} onClick={() => open("catalog")}>
          ▱ Satellites
        </button>
        <button
          aria-pressed={air.open && air.tab === "aircraft"}
          onClick={() => open("aircraft")}
        >
          ✈ Aircraft
        </button>
        <button
          aria-pressed={air.open && air.tab === "launches"}
          onClick={() => open("launches")}
        >
          ↑ Rockets
        </button>
        <button aria-pressed={ui.earthOpen} onClick={() => open("earth")}>
          Earth
        </button>
        <button
          aria-expanded={layersOpen}
          onClick={() => setLayersOpen(!layersOpen)}
        >
          Layers
        </button>
      </nav>
      {layersOpen && (
        <section className="layer-menu" aria-label="Visible layers">
          <header>
            <strong>Visible on globe</strong>
            <button
              onClick={() => setLayersOpen(false)}
              aria-label="Close layers"
            >
              ×
            </button>
          </header>
          {(
            [
              {
                key: "satellites",
                label: "Satellites",
                checked: scene.satellitesOn,
              },
              { key: "aircraft", label: "Aircraft", checked: air.aircraftOn },
              {
                key: "rockets",
                label: "Rockets & launch sites",
                checked: air.launchesOn,
              },
            ] as const
          ).map((layer) => (
            <div key={layer.key}>
              <label>
                <input
                  type="checkbox"
                  checked={layer.checked}
                  onChange={(e) => {
                    if (layer.key === "satellites")
                      scene.setSatellitesOn(e.target.checked);
                    else
                      air.set(
                        layer.key === "aircraft"
                          ? { aircraftOn: e.target.checked }
                          : { launchesOn: e.target.checked },
                      );
                  }}
                />
                {layer.label}
              </label>
              <button
                onClick={() => {
                  scene.setSatellitesOn(layer.key === "satellites");
                  air.set({
                    aircraftOn: layer.key === "aircraft",
                    launchesOn: layer.key === "rockets",
                  });
                }}
              >
                Only
              </button>
            </div>
          ))}
          <button
            className="layer-show-all"
            onClick={() => {
              scene.setSatellitesOn(true);
              air.set({ aircraftOn: true, launchesOn: true });
            }}
          >
            Show all layers
          </button>
          <p>Satellite density</p>
          <div className="layer-density">
            <button
              aria-pressed={scene.catalogDensity === "reduced"}
              onClick={() => scene.setCatalogDensity("reduced")}
            >
              Balanced
            </button>
            <button
              aria-pressed={scene.catalogDensity === "all"}
              onClick={() => scene.setCatalogDensity("all")}
            >
              Full catalog
            </button>
          </div>
        </section>
      )}

      {ui.hover && !ui.choices.length && (
        <div
          className="object-tooltip"
          style={{
            left: Math.min(ui.hover.x + 16, window.innerWidth - 270),
            top: Math.max(10, ui.hover.y - 44),
          }}
        >
          {ui.hover.text}
        </div>
      )}
      {!!ui.choices.length && (
        <section className="object-chooser" aria-label="Choose an object">
          <header>
            <strong>Objects here</strong>
            <button
              aria-label="Close object chooser"
              onClick={() => ui.set({ choices: [] })}
            >
              ×
            </button>
          </header>
          <p>Choose what you want to inspect.</p>
          {ui.choices.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                ui.set({ choices: [], hover: null });
                c.select();
              }}
            >
              <strong>{c.name}</strong>
              <span>{c.detail}</span>
            </button>
          ))}
        </section>
      )}
    </>
  );
}
