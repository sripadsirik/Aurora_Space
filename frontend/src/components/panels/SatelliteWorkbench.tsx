import { useExplorer } from "../../explorer/store";
import { CatalogCensus } from "../scene/CatalogCensus";
import { catalogQuality } from "../../utils/catalogQuality";
import { objectClassification } from "../../utils/objectType";
import { useMemo, useState } from "react";
import { useAuroraStore } from "../../store/auroraStore";
import { elementEpoch } from "../../utils/propagation";
import { csv, downloadText } from "../../utils/download";
import { useSceneStore } from "../../store/sceneStore";
import { ConjunctionWorkbench } from "./ConjunctionWorkbench";

export function SatelliteWorkbench() {
  const explorer = useExplorer();
  const tab = useSceneStore(s => s.opsPanel);
  const setTab = useSceneStore(s => s.setOpsPanel);
  const mode=useAuroraStore(s=>s.currentMode);
  const satellites=useAuroraStore(s=>s.satellites);
  const selected=useAuroraStore(s=>s.selectedSatellite);
  const activePanels=useAuroraStore(s=>s.activePanels);
  const setSelected=useAuroraStore(s=>s.setSelectedSatellite);
  const received=useAuroraStore(s=>s.feedLastUpdated.satellites);
  const [kind,setKind]=useState("all");
  const [exceptionsOnly,setExceptionsOnly]=useState(false);
  const quality=useMemo(()=>catalogQuality(satellites),[satellites]);
  const exceptions=useMemo(()=>new Set(quality.objects.filter(o=>o.issues.length).map(o=>o.noradId)),[quality]);
  const [query,setQuery]=useState("");
  const [regime,setRegime]=useState("all");
  const [age,setAge]=useState("all");
  const [pins,setPins]=useState<number[]>([]);
  const [pinnedOnly,setPinnedOnly]=useState(false);
  const [page,setPage]=useState(0);
  const catalog=useMemo(()=>satellites.map(s=>{const epoch=elementEpoch(s);return {satellite:s,epoch,ageDays:epoch?(Date.now()-epoch.getTime())/86400000:null};}),[satellites]);
  const fresh=catalog.filter(s=>s.ageDays!==null && s.ageDays>=-1 && s.ageDays<=3).length;
  const filtered=useMemo(()=>catalog.filter(({satellite:s,ageDays})=>(kind==="all"||objectClassification(s).label===kind)&&(!exceptionsOnly||exceptions.has(s.noradId))&&(regime==="all"||s.orbitType===regime)&&(!pinnedOnly||pins.includes(s.noradId))&&`${s.name} ${s.noradId}`.toLowerCase().includes(query.toLowerCase())&&(age==="all"||(age==="fresh"?ageDays!==null&&ageDays<=3&&ageDays>=-1:ageDays===null||ageDays>3))).sort((a,b)=>a.satellite.name.localeCompare(b.satellite.name)),[catalog,regime,pinnedOnly,pins,query,age,kind,exceptionsOnly,exceptions]);
  const currentPage=Math.min(page,Math.max(0,Math.ceil(filtered.length/10)-1));
  if(mode!=="OPS"||!explorer.catalogOpen||selected||activePanels.size>0)return null;
  return <section className={`satellite-workbench mode-panel ${tab === "pairs" ? "satellite-workbench--pairs" : ""}`} aria-label="Orbital operations">
    <div className="inspector-heading"><strong>Satellites</strong><button aria-label="Close satellite catalog" onClick={()=>explorer.set({catalogOpen:false})}>×</button></div>
    <div className="workbench-tabs" role="group" aria-label="Operations workspace"><button aria-pressed={tab === "catalog"} onClick={() => setTab("catalog")}>Satellite catalog</button><button aria-pressed={tab === "pairs"} onClick={() => setTab("pairs")}>Conjunction pairs</button></div>
    {tab === "pairs" ? <ConjunctionWorkbench /> : <>
    <div className="engineering-panel-title catalog-intro"><span className="scene-eyebrow">SATELLITE OPERATIONS</span><h2>Catalog & orbit inspection</h2><p>{received?"Public orbital elements · CelesTrak / Space-Track":"Sample catalog · live feed not received"}</p></div>
    <details className="catalog-assurance"><summary>Catalog coverage & rendering</summary><CatalogCensus /></details>
    <details className="catalog-assurance"><summary>Data quality · {quality.summary.exceptions.toLocaleString()} exceptions</summary>
      <p>{quality.summary.authoritative.toLocaleString()} / {satellites.length.toLocaleString()} matched to authoritative SATCAT metadata · {quality.summary.debris.toLocaleString()} labelled debris · {quality.summary.withheld.toLocaleString()} withheld from current-position display.</p>
      <p>Partial catalog: selected GP groups. OMM supports six/nine-digit NORAD IDs. Feed freshness does not establish orbital accuracy.</p>
      <button onClick={()=>downloadText("aurora-catalog-quality.json",JSON.stringify(quality,null,2))}>Export all object checks · JSON</button>
    </details>
    <div className="catalog-filters"><label className="sr-only" htmlFor="catalog-search">Find satellite</label><input id="catalog-search" placeholder="Name or NORAD ID" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>
      <div><select aria-label="Orbital regime" value={regime} onChange={e=>{setRegime(e.target.value);setPage(0);}}><option value="all">All regimes</option><option>LEO</option><option>MEO</option><option>GEO</option></select><select aria-label="Element age" value={age} onChange={e=>{setAge(e.target.value);setPage(0);}}><option value="all">All element ages</option><option value="fresh">≤ 3 days</option><option value="aged">Aged / unavailable</option></select></div>
      <select aria-label="Object classification" value={kind} onChange={e=>{setKind(e.target.value);setPage(0);}}><option value="all">All object types</option><option>Debris</option><option>Payload</option><option>Rocket body</option><option>Unknown</option></select>
      <label className="review-check"><input type="checkbox" checked={exceptionsOnly} onChange={e=>{setExceptionsOnly(e.target.checked);setPage(0);}}/>Data-quality exceptions only</label>
      <label className="review-check"><input type="checkbox" checked={pinnedOnly} onChange={e=>{setPinnedOnly(e.target.checked);setPage(0);}}/>Pinned in this session ({pins.length})</label></div>
    <div className="catalog-results">{filtered.slice(currentPage*10,currentPage*10+10).map(({satellite:s,ageDays})=><div className="catalog-row" key={s.noradId}><button aria-label={`${pins.includes(s.noradId)?"Unpin":"Pin"} ${s.name}`} aria-pressed={pins.includes(s.noradId)} onClick={()=>setPins(pins.includes(s.noradId)?pins.filter(id=>id!==s.noradId):[...pins,s.noradId])}>{pins.includes(s.noradId)?"★":"☆"}</button><button onClick={()=>setSelected(s)}><strong>{s.name}</strong><span>#{s.noradId} · {objectClassification(s).label} · {s.orbitType} · {Math.round(s.altitudeKm).toLocaleString()} km</span></button><span className={ageDays===null||ageDays>3?"engineering-caution":""}>{ageDays===null?"No TLE":`${Math.max(0,ageDays).toFixed(1)}d`}</span></div>)}{!filtered.length&&<p className="engineering-note">No matching objects.</p>}</div>
    <div className="catalog-pagination"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>←</button><span>{filtered.length.toLocaleString()} results · Page {currentPage+1}</span><button disabled={(currentPage+1)*10>=filtered.length} onClick={()=>setPage(currentPage+1)}>→</button></div>
    <button className="engineering-export" onClick={()=>downloadText("aurora-catalog.csv",csv([["NORAD","Name","Regime","Snapshot altitude km","TLE epoch UTC","TLE age days"],...filtered.map(({satellite:s,epoch,ageDays})=>[s.noradId,s.name,s.orbitType,s.altitudeKm,epoch?.toISOString()??null,ageDays])]),"text/csv")} disabled={!filtered.length}>Export filtered catalog · CSV</button>
    <p className="engineering-note">Element age and feed receipt are different. Select an object to inspect its source TLE and export its SGP4 trajectory. Age ≤ 3d is a review filter, not an accuracy guarantee.</p>
    </>}
  </section>;
}
