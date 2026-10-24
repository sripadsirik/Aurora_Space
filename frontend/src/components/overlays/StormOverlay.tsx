import { useAuroraStore } from "../../store/auroraStore";
import { useSceneStore } from "../../store/sceneStore";

export const StormOverlay = (): JSX.Element | null => {
  const mode = useAuroraStore(s => s.currentMode);
  const weather = useAuroraStore(s => s.spaceWeather);
  const selected = useAuroraStore(s => s.selectedSatellite);
  const received = useAuroraStore(s => s.feedLastUpdated.spaceWeather);
  const enabled = useSceneStore(s => s.spaceWeather);
  const toggle = useSceneStore(s => s.toggle);
  const camera = useSceneStore(s => s.requestCamera);
  if (mode !== "STORM") return null;
  return <>
    <div className="storm-atmosphere" aria-hidden="true" />
    <aside className="aurora-observatory" aria-label="Aurora visualization controls">
      <div className="aurora-card-eyebrow"><span className="aurora-status-dot" /> POLAR LIGHTS <span>EARTH / 02</span></div>
      <h2>The auroral oval</h2>
      <p className="aurora-intro">A luminous view of the polar atmosphere.</p>
      <div className="aurora-orbit-art" aria-hidden="true"><div className="aurora-art-halo"/><div className="aurora-art-ring ring-outer"/><div className="aurora-art-ring ring-inner"/><div className="aurora-art-earth"/><span>N</span></div>
      <div className="aurora-index"><div><span>PLANETARY ACTIVITY</span><strong>{received ? weather.kpIndex.toFixed(1) : "—"}<small> Kp</small></strong></div><div className="aurora-kp-bars" aria-label={received ? `Kp ${weather.kpIndex.toFixed(1)} of 9` : "Kp unavailable"}>{Array.from({length:9},(_,i)=><i key={i} className={received && i < Math.round(weather.kpIndex) ? "lit" : ""} style={{height:12+i*3}} />)}</div></div>
      <div className="aurora-view-buttons"><button onClick={()=>camera("polar")}>Polar view ↗</button><button onClick={()=>camera("terminator")}>Night edge ↗</button></div>
      <button className="aurora-layer-toggle" aria-pressed={enabled} onClick={()=>toggle("spaceWeather")}><span>Atmospheric layers</span><span>{enabled ? "ON" : "OFF"}<i className={enabled ? "is-on" : ""}/></span></button>
      <div className="aurora-color-key"><span><i/>Lower curtain</span><span><i/>Upper glow</span></div>
      <p className="aurora-model-note">Illustrative Kp-driven oval and schematic dipole field lines. Curtain height, color and motion are stylized; this is not an aurora visibility forecast or a measured emission map.</p>
    </aside>
    {!selected && <div className="storm-scene-caption"><span className="aurora-status-dot"/> MAGNETOSPHERE OBSERVATORY <small>Drag to explore · Scroll to zoom</small></div>}
  </>;
};
