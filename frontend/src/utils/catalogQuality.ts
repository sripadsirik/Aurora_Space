import type { Satellite } from "../types/space";
import { elementEpoch, hasCurrentElements } from "./propagation";
import { objectClassification } from "./objectType";
export function catalogQuality(satellites: Satellite[], now = new Date()) {
 const objects=satellites.map(s=>{
  const epoch=elementEpoch(s);const ageDays=epoch?(now.getTime()-epoch.getTime())/86400000:null;
  const classification=objectClassification(s);
  return {noradId:s.noradId,name:s.name,type:classification.label,classificationSource:classification.source,metadataFetchedAt:s.metadataFetchedAt??null,elementEpoch:epoch?.toISOString()??null,ageDays,decayDate:s.decayDate??null,eligibility:hasCurrentElements(s,now)?"Eligible for propagation; success still required":"Withheld",issues:[...(!s.metadataSource?["No authoritative metadata joined"]:[]),...(s.metadataFetchedAt && now.getTime()-Date.parse(s.metadataFetchedAt)>48*3600000?["Metadata older than 48h"]:[]),...(s.decayDate?["Catalog reports decay"]:[]),...(!epoch?["Missing or invalid elements"]:[]),...(ageDays!==null&&ageDays>14?["Elements older than 14d"]:ageDays!==null&&ageDays>3?["Elements older than 3d"]:[]),...(ageDays!==null&&ageDays < -1?["Future epoch"]:[])]};
 });
 return {schema:"aurora-catalog-quality-v1",generatedAt:now.toISOString(),scope:"Loaded catalog only. Selected TLE groups; not all public objects. Six-digit NORAD IDs require an OMM ingestion path, which is not implemented.",limitations:"No independent sensor residuals or position covariance. Eligibility does not imply orbital accuracy or successful propagation.",summary:{loaded:objects.length,authoritative:objects.filter(o=>o.classificationSource==="CelesTrak SATCAT").length,debris:objects.filter(o=>o.type==="Debris").length,withheld:objects.filter(o=>o.eligibility==="Withheld").length,exceptions:objects.filter(o=>o.issues.length).length},objects};
}
