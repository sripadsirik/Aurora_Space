import { useEffect, useState } from "react";
import { useUtcClock } from "../../hooks/useUtcClock";
import { useAuroraStore } from "../../store/auroraStore";
import type { SpaceWeather } from "../../types/space";
import { kpToGScale, gScaleColor, xrayClassToRScaleInfo, protonFluxToSScaleInfo } from "../../utils/spaceWeatherScales";
import { solarWindDynamicPressure } from "../../utils/solarWindPressure";
import { geoeffectiveElectricField } from "../../utils/solarWindElectricField";
import { describeFeedFreshness } from "../../utils/feedFreshness";
import { downloadText, csv } from "../../utils/download";

export const StormImpactPanel = (): JSX.Element | null => {
  const mode=useAuroraStore(s=>s.currentMode);
  const weather=useAuroraStore(s=>s.spaceWeather);
  const received=useAuroraStore(s=>s.feedLastUpdated.spaceWeather);
  const satellites=useAuroraStore(s=>s.satellites);
  const selected=useAuroraStore(s=>s.selectedSatellite);
  const [history,setHistory]=useState<SpaceWeather[]>([]);
  const [metric,setMetric]=useState<"solarWindSpeed"|"bzComponent"|"kpIndex">("bzComponent");
  const now=useUtcClock();
  useEffect(()=>{if(!received)return;setHistory(rows=>rows.at(-1)?.lastUpdated.getTime()===weather.lastUpdated.getTime()?rows:[...rows,weather].slice(-120));},[weather,received]);
  if(mode!=="STORM")return null;
  const g=kpToGScale(weather.kpIndex);
  const r=xrayClassToRScaleInfo(weather.xrayFlux);
  const radiation=weather.protonFlux===undefined?null:protonFluxToSScaleInfo(weather.protonFlux);
  const freshness=describeFeedFreshness(received,now);
  const valid=received!==null;
  const values=history.map(sample=>sample[metric]);
  const low=Math.min(...values),high=Math.max(...values);
  const start=history[0]?.lastUpdated.getTime()??0,end=history.at(-1)?.lastUpdated.getTime()??1;
  const points=history.map(sample=>`${8+((sample.lastUpdated.getTime()-start)/Math.max(1,end-start))*284},${high===low?51:84-((sample[metric]-low)/(high-low))*66}`).join(" ");
  return <section className="weather-workbench mode-panel" aria-label="Space weather monitoring">
    <div className="engineering-panel-title"><span className="scene-eyebrow">NOAA SWPC · MONITORING</span><h2>Solar conditions</h2><p className={freshness.status!=="live"?"engineering-caution":""}>{valid?`Feed received ${freshness.label}`:"Awaiting weather feed · no measured values available"}</p></div>
    {valid&&<>
    <div className="weather-scales"><div><span>GEOMAGNETIC</span><strong style={{color:gScaleColor(g)}}>{g}</strong><small>Kp {weather.kpIndex.toFixed(1)}</small></div><div><span>RADIO BLACKOUT</span><strong>{r.level}</strong><small>X-ray {weather.xrayFlux}</small></div><div><span>SOLAR RADIATION</span><strong>{radiation?.level??"—"}</strong><small>{weather.protonFlux===undefined?"No proton measurement":`${weather.protonFlux} pfu`}</small></div></div>
    <div className="storm-wind-hero"><span>UPSTREAM SOLAR WIND</span><div><strong>{weather.solarWindSpeed.toFixed(0)}</strong><span>km/s</span><svg viewBox="0 0 120 46" aria-hidden="true"><path d="M0 8H77M16 23H104M0 38H84"/><path d="m72 3 7 5-7 5m27 5 7 5-7 5m-24 5 7 5-7 5"/></svg></div><p>IMF Bz <b>{weather.bzComponent.toFixed(2)} nT</b><span>{weather.bzComponent < 0 ? "Southward" : "Northward"}</span></p></div>
    <dl className="engineering-readouts"><dt>Solar wind speed</dt><dd>{weather.solarWindSpeed.toFixed(1)} km/s</dd><dt>Proton density</dt><dd>{weather.solarWindDensity.toFixed(2)} cm⁻³</dd><dt>IMF Bz</dt><dd className={weather.bzComponent<0?"engineering-caution":""}>{weather.bzComponent.toFixed(2)} nT</dd><dt>Dynamic pressure*</dt><dd>{solarWindDynamicPressure(weather.solarWindDensity,weather.solarWindSpeed).toFixed(2)} nPa</dd><dt>Southward coupling*</dt><dd>{geoeffectiveElectricField(weather.solarWindSpeed,weather.bzComponent).toFixed(2)} mV/m</dd><dt>Feed timestamp · UTC</dt><dd>{weather.lastUpdated.toISOString().replace("T"," ").slice(0,19)}</dd></dl>
    <details className="storm-method"><summary>Measurement notes</summary><p className="engineering-note">*Derived: proton-only pressure = mₚnv²; coupling = V·max(−Bz,0). Individual measurement epochs and alpha-particle contribution are not supplied in this feed.</p></details>
    <div className="weather-history"><label>Session trend<select value={metric} onChange={e=>setMetric(e.target.value as typeof metric)}><option value="bzComponent">IMF Bz · nT</option><option value="solarWindSpeed">Wind · km/s</option><option value="kpIndex">Kp index</option></select></label>
    {history.length>1?<><div className="weather-chart-labels"><span>{high.toFixed(1)} max</span><span>{low.toFixed(1)} min</span></div><svg viewBox="0 0 300 100" role="img" aria-label={`${metric} observed during this session`}><path d="M8 18H292 M8 51H292 M8 84H292" stroke="#ffffff14" fill="none"/><polygon points={`8,92 ${points} 292,92`} fill="url(#storm-trend-fill)"/><defs><linearGradient id="storm-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#72e8ce" stopOpacity="0.25"/><stop offset="100%" stopColor="#72e8ce" stopOpacity="0"/></linearGradient></defs><polyline points={points} stroke="#72e8ce" strokeWidth="2" fill="none"/></svg><div className="weather-chart-labels"><span>{history[0].lastUpdated.toISOString().slice(11,19)} UTC</span><span>{history.at(-1)!.lastUpdated.toISOString().slice(11,19)} UTC</span></div></>:<p className="engineering-note">Collecting session samples. A trend appears after the next distinct weather update.</p>}
    <button className="engineering-export" disabled={!history.length} onClick={()=>downloadText("aurora-weather-session.csv",csv([["Feed UTC","Kp","Wind km/s","Density cm^-3","Bz nT","X-ray class","Protons pfu"],...history.map(w=>[w.lastUpdated.toISOString(),w.kpIndex,w.solarWindSpeed,w.solarWindDensity,w.bzComponent,w.xrayFlux,w.protonFlux??null])]),"text/csv")}>Export observed session · CSV</button></div>
    </>}
    <div className="weather-context"><h3>Mission context</h3><p>{selected?`${selected.name} · ${selected.orbitType}`:`Catalog: ${satellites.filter(s=>s.orbitType==="LEO").length.toLocaleString()} LEO objects`}</p><p className="engineering-note">{selected?.orbitType==="GEO"?"Review charging environment and operator telemetry. Kp alone cannot establish spacecraft charging risk.":"Elevated geomagnetic activity can change atmospheric drag. Review updated orbit determination and mission density models; this view does not estimate per-spacecraft drag or decay."}</p></div>
    <div className="weather-links"><a href="https://www.swpc.noaa.gov/products/alerts-watches-and-warnings" target="_blank" rel="noreferrer">NOAA alerts & warnings ↗</a><a href="https://www.swpc.noaa.gov/products/3-day-forecast" target="_blank" rel="noreferrer">Official 3-day forecast ↗</a><a href="https://www.swpc.noaa.gov/noaa-scales-explanation" target="_blank" rel="noreferrer">NOAA scale definitions ↗</a></div>
  </section>;
};
