import { useAuroraStore } from "../../store/auroraStore";
import { useSceneStore } from "../../store/sceneStore";

export function CatalogCensus() {
  const stats = useSceneStore(s => s.catalogStats);
  const density = useSceneStore(s => s.catalogDensity);
  const setDensity = useSceneStore(s => s.setCatalogDensity);
  const camera = useSceneStore(s => s.requestCamera);
  const mode = useAuroraStore(s => s.currentMode);
  if (mode === "HELIO" || !stats) return null;
  return <section className="catalog-census" aria-label="Catalog rendering status">
    <div className="catalog-census-heading"><span>ORBITAL CATALOG</span><button onClick={() => camera("catalog")} aria-label="Fit catalog overview">Overview ↗</button></div>
    <dl><div><dt>Loaded objects</dt><dd>{stats.total.toLocaleString()}</dd></div><div><dt>Plotted</dt><dd>{stats.plotted.toLocaleString()}</dd></div><div><dt>Withheld</dt><dd>{stats.withheld.toLocaleString()}</dd></div></dl>
    <p>{stats.state === "loading" ? "Calculating current orbital positions…" : stats.state === "error" ? "Position worker failed. Reload to retry." : stats.state === "late" ? "Position calculation delayed; outdated objects hidden." : stats.state === "demo" ? "Demonstration positions · not a live catalog" : "SGP4 positions at current UTC · Earth hides far-side objects."}</p>
    <div className="catalog-point-key"><span><i className="catalog-payload"/>Payload</span><span><i className="catalog-debris"/>Debris</span><span><i className="catalog-rocket"/>Rocket body</span><span><i className="catalog-unknown"/>Unknown</span></div>
    <div className="catalog-density-switch" role="group" aria-label="Catalog density"><button aria-pressed={density === "all"} onClick={() => setDensity("all")}>Full catalog</button><button aria-pressed={density === "reduced"} onClick={() => setDensity("reduced")}>Reduced density</button></div>
    <small>{stats.limited > 0 ? `${stats.limited.toLocaleString()} eligible objects hidden by Reduced density. ` : ""}Withheld: missing, expired, decayed or invalid orbital data. Colors use supplied object types or name-based inference. Silhouettes at wide zoom; representative 3D models up close. Select an object to inspect its orbit.</small>
  </section>;
}
