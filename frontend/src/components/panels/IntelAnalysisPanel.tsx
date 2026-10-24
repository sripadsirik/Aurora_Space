import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useUtcClock } from "../../hooks/useUtcClock";
import { useAuroraStore } from "../../store/auroraStore";
import { feedReview, mergeReviewReports, parseReviewImport, reviewAnnotations, reviewCompleteness, sameEncounter, type ReviewReport } from "../../utils/conjunctionReview";
import { csv, downloadText } from "../../utils/download";
import { describeFeedFreshness } from "../../utils/feedFreshness";

const number = (n:number|null, unit="") => n === null ? "Not supplied" : `${n.toLocaleString(undefined,{maximumFractionDigits:3})}${unit}`;
const pc = (n:number|null) => n === null ? "Unknown" : n.toExponential(2);
const utc = (s:string) => s ? new Date(s).toISOString().replace("T"," ").replace(".000Z"," UTC") : "Not supplied";

export const IntelAnalysisPanel = (): JSX.Element | null => {
  const mode = useAuroraStore(s=>s.currentMode);
  const feed = useAuroraStore(s=>s.conjunctions);
  const fetched = useAuroraStore(s=>s.feedLastUpdated.conjunctions);
  const satellites = useAuroraStore(s=>s.satellites);
  const setSatellite = useAuroraStore(s=>s.setSelectedSatellite);
  const setMode = useAuroraStore(s=>s.setMode);
  const now = useUtcClock();
  const [imports,setImports]=useState<ReviewReport[]>([]);
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [query,setQuery]=useState("");
  const [horizon,setHorizon]=useState("168");
  const [minimumPc,setMinimumPc]=useState("");
  const [maximumMiss,setMaximumMiss]=useState("");
  const [sort,setSort]=useState("tca");
  const [error,setError]=useState("");
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [reviewed,setReviewed]=useState<Record<string,boolean>>({});
  const input=useRef<HTMLInputElement>(null);
  const key=(r:ReviewReport)=>`${r.source}/${r.id}`;
  const reports=useMemo(()=>[...feed.filter(r=>r.source).map(feedReview),...imports],[feed,imports]);
  const filtered=useMemo(()=>reports.filter(r=>{
    const hours=(Date.parse(r.tca)-now.getTime())/3600000;
    return (horizon === "all" || (hours>=0 && hours<=Number(horizon))) &&
      (maximumMiss === "" || (r.missDistanceM !== null && r.missDistanceM <= Number(maximumMiss))) &&
      (minimumPc === "" || (r.pc !== null && r.pc>=Number(minimumPc))) &&
      `${r.id} ${r.objects.map(o=>`${o.name} ${o.id}`).join(" ")}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a,b)=>sort === "pc" ? (b.pc ?? -1)-(a.pc ?? -1) : sort === "miss" ? (a.missDistanceM ?? Infinity)-(b.missDistanceM ?? Infinity) : Date.parse(a.tca)-Date.parse(b.tca)),[reports,now,horizon,minimumPc,maximumMiss,query,sort]);
  const selected=filtered.find(r=>key(r)===selectedKey) ?? filtered[0];
  const related=selected ? reports.filter(r=>sameEncounter(r,selected)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)) : [];
  const completeness=selected ? reviewCompleteness(selected) : null;
  const freshness=describeFeedFreshness(fetched,now,490,1440);
  const exportReview=()=>downloadText(`aurora-conjunction-review-${now.toISOString().slice(0,10)}.json`,JSON.stringify({schema:"aurora-review-v1",exportedAt:now.toISOString(),feedFetchedAt:fetched?.toISOString() ?? null,units:{missDistanceM:"m",relativeSpeedMs:"m/s",pc:"dimensionless",time:"UTC"},reports:filtered,notes,reviewed,limitations:"Review workspace; supplied Pc is not recomputed. No maneuver solution or independent covariance validation."},null,2));
  const importFiles=async(event:ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(event.target.files ?? []); event.target.value="";
    if (files.length>30) {setError("Import up to 30 files at once");return;}
    try {
      let next=imports;
      let nextNotes={...notes}, nextReviewed={...reviewed};
      for(const file of files){if(file.size>2_000_000)throw new Error(`${file.name}: exceeds 2 MB`);const text=await file.text();const parsed=parseReviewImport(text,file.name);next=mergeReviewReports(next,parsed);const annotations=reviewAnnotations(text,parsed);nextNotes={...nextNotes,...annotations.notes};nextReviewed={...nextReviewed,...annotations.reviewed};}
      setImports(next);setNotes(nextNotes);setReviewed(nextReviewed);setError("");setHorizon("all");
    }catch(e){setError(e instanceof Error?e.message:"Import failed");}
  };
  if(mode!=="INTEL")return null;
  return <section className="review-workbench" aria-label="Conjunction review workbench">
    <div className="review-topline"><div><span className="scene-eyebrow">ASSESSMENT QUEUE</span><h2>Conjunction review</h2></div><div className="review-actions">
      <input ref={input} type="file" accept=".cdm,.kvn,.txt,.json" multiple onChange={importFiles} className="sr-only" aria-label="Import CDM files" />
      <button onClick={()=>input.current?.click()}>＋ Import CDM</button>
      <button disabled={!filtered.length} onClick={exportReview}>Export review</button>
      <button disabled={!filtered.length} onClick={()=>downloadText("conjunctions.csv",csv([["Report ID","Source","Created UTC","TCA UTC","Object 1","Object 2","Pc","Miss distance (m)","Relative speed (m/s)"],...filtered.map(r=>[r.id,r.source,r.createdAt,r.tca,r.objects[0].id,r.objects[1].id,r.pc,r.missDistanceM,r.relativeSpeedMs])]),"text/csv")}>CSV</button>
    </div></div>
    <div className="review-summary"><span><b>{reports.length}</b> reports available</span><span><b>{filtered.length}</b> in current filter</span><span><b>{imports.length}</b> local imports</span><span className={freshness.status!=="live"?"engineering-caution":""}>Public feed: {fetched ? `${freshness.label} · ${utc(fetched.toISOString())}` : "Not received"}</span></div>
    <div className="review-filters">
      <label>Object / report<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="NORAD ID, name or report ID" /></label>
      <label>TCA window<select value={horizon} onChange={e=>setHorizon(e.target.value)}><option value="24">Next 24 hours</option><option value="72">Next 72 hours</option><option value="168">Next 7 days</option><option value="all">All, including past reports</option></select></label>
      <label>Minimum supplied Pc<select value={minimumPc} onChange={e=>setMinimumPc(e.target.value)}><option value="">All / unknown</option><option value="0.000001">≥ 1e−6</option><option value="0.00001">≥ 1e−5</option><option value="0.0001">≥ 1e−4</option><option value="0.001">≥ 1e−3</option></select></label>
      <label>Maximum miss · m<input type="number" min="0" value={maximumMiss} onChange={e=>setMaximumMiss(e.target.value)} placeholder="Any distance" /></label>
      <label>Sort by<select value={sort} onChange={e=>setSort(e.target.value)}><option value="tca">Soonest TCA</option><option value="pc">Highest Pc</option><option value="miss">Smallest miss distance</option></select></label>
    </div>
    {error && <p role="alert" className="review-error">{error}</p>}
    <div className="review-columns"><div className="review-queue">
      <table><thead><tr><th>Object pair / report</th><th>TCA · UTC</th><th>Supplied Pc</th><th>Miss · m</th></tr></thead><tbody>
      {filtered.map(r=><tr key={key(r)} className={selected && key(r)===key(selected)?"is-selected":""}><td><button onClick={()=>setSelectedKey(key(r))}><strong>{r.objects[0].name} / {r.objects[1].name}</strong><span>{r.objects[0].id} ↔ {r.objects[1].id} · {r.id}</span><small>{r.imported?"LOCAL IMPORT":"PUBLIC SUMMARY"}{reviewed[key(r)]?" · REVIEWED":""}</small></button></td><td>{utc(r.tca)}{Date.parse(r.tca)<now.getTime()&&<small className="engineering-caution">PAST TCA</small>}</td><td>{pc(r.pc)}</td><td>{number(r.missDistanceM)}</td></tr>)}
      </tbody></table>
      {!filtered.length&&<div className="engineering-empty"><span>◎</span><h3>{reports.length?"No reports match these filters":"No current reports to assess"}</h3><p>{reports.length?"Change the TCA window, probability filter or object search.":"An empty or stale public feed does not establish that the catalog is free of conjunctions. Import a provider CDM to start a review."}</p><button onClick={()=>input.current?.click()}>Import a conjunction report</button></div>}
      <div className="review-import-help"><strong>Bring your own reports</strong><p>CCSDS CDM KVN (.cdm / .kvn / .txt) or Aurora review JSON. Parsed locally in this tab; nothing is uploaded. UTC, metres and m/s are checked. XML and provider-specific JSON are not supported.</p>{imports.length>0&&<button onClick={()=>{setImports([]);setSelectedKey(null);setNotes({});setReviewed({});}}>Clear local review</button>}<p>Export before closing this tab to keep reports and notes.</p></div>
    </div>
    <aside className="review-inspector">{selected && completeness ? <>
      <div className="review-inspector-heading"><span className="scene-eyebrow">REPORT INSPECTOR</span><h3>{selected.id}</h3><p>{selected.source}</p></div>
      <div className="review-object-buttons">{selected.objects.map(o=>{const sat=satellites.find(s=>String(s.noradId)===o.id);return <button key={o.id} disabled={!sat} title={sat?"Inspect current catalog orbit in OPS":"Object absent from current satellite catalog"} onClick={()=>{if(sat){setSatellite(sat);setMode("OPS");}}}>{o.name}<span>#{o.id} · {sat?"Inspect satellite ↗":"Not in catalog"}</span></button>;})}</div>
      <dl className="engineering-readouts"><dt>TCA · UTC</dt><dd>{utc(selected.tca)}</dd><dt>Report issued</dt><dd>{utc(selected.createdAt)}</dd><dt>Time to TCA</dt><dd>{((Date.parse(selected.tca)-now.getTime())/3600000).toFixed(2)} h</dd><dt>Miss distance</dt><dd>{number(selected.missDistanceM," m")}</dd><dt>Supplied Pc</dt><dd>{pc(selected.pc)}</dd><dt>Pc method</dt><dd>{selected.method}</dd><dt>Relative speed</dt><dd>{number(selected.relativeSpeedMs," m/s")}</dd></dl>
      <h4>Data available for assessment</h4><div className="review-coverage">{selected.objects.map((o,i)=><div key={o.id}><strong>Object {i+1}</strong><span>State vector: {completeness.states[i]?"6 fields supplied":"incomplete / absent"}</span><span>Position covariance: {completeness.positionCovariances[i]?"6 RTN terms supplied":"incomplete / absent"}</span><span>Frame: {o.fields.REF_FRAME ?? "not supplied"}</span></div>)}</div>
      <p className="engineering-note">Field presence is not covariance validation. Pc is provider-supplied, not recalculated here. Maneuver assessment also requires validated uncertainties, hard-body radii, operational ephemerides and mission constraints.</p>
      <details><summary>Related reports ({related.length})</summary><p className="engineering-note">Same object pair and TCA within 30 minutes; confirm event identity with the provider.</p>{related.map(r=><button className="review-revision" key={key(r)} onClick={()=>setSelectedKey(key(r))}>{utc(r.createdAt)}<span>Pc {pc(r.pc)} · {number(r.missDistanceM," m")}</span></button>)}</details>
      <details><summary>Supplied object fields</summary>{selected.objects.map(o=><div key={o.id}><h4>{o.name}</h4>{Object.keys(o.fields).length ? <dl className="engineering-readouts">{Object.entries(o.fields).map(([field,value])=><div className="review-field" key={field}><dt>{field}</dt><dd>{String(value)}</dd></div>)}</dl>:<p className="engineering-note">Public summary does not include object state/covariance fields.</p>}</div>)}</details>
      <label className="review-notes">Analyst notes<textarea value={notes[key(selected)]??""} onChange={e=>setNotes({...notes,[key(selected)]:e.target.value})} placeholder="Record assumptions, data requests and operator coordination…" /></label>
      <label className="review-check"><input type="checkbox" checked={reviewed[key(selected)]??false} onChange={e=>setReviewed({...reviewed,[key(selected)]:e.target.checked})}/>Marked reviewed by me (not a safety clearance)</label>
      <a href="https://www.nasa.gov/cara/" target="_blank" rel="noreferrer">NASA conjunction-assessment guidance ↗</a>
    </>:<div className="engineering-empty"><h3>Select a report</h3><p>Report provenance, close-approach metrics and missing inputs appear here.</p></div>}</aside></div>
  </section>;
};
