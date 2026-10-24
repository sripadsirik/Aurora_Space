// Usage: node frontend/scripts/audit-catalog.mjs snapshot.json satcat.csv output.json
// Audits every supplied object; does not compare against sensor observations.
import fs from 'node:fs';
import {twoline2satrec,propagate,eciToEcf,gstime,geodeticToEcf} from 'satellite.js';
import {createHash} from 'node:crypto';
const [snapshotPath,metadataPath,outputPath]=process.argv.slice(2);
if(!outputPath)throw Error('Expected snapshot JSON, SATCAT CSV and output JSON paths');
function csv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}if(quoted)throw Error('Truncated CSV');if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
const metadata=fs.readFileSync(metadataPath,'utf8');const [header,...records]=csv(metadata);
const field=Object.fromEntries(header.map((key,i)=>[key,i]));
for(const key of ['NORAD_CAT_ID','OBJECT_TYPE','DECAY_DATE','ORBIT_CENTER','ORBIT_TYPE'])if(!(key in field))throw Error(`Missing ${key}`);
const catalog=new Map(records.map(row=>[Number(row[field.NORAD_CAT_ID]),Object.fromEntries(header.map((k,i)=>[k,row[i]]))]));
const now=new Date(snapshot.capturedAt);const seen=new Set();const details=[];
const checksum=line=>line?.length===69 && [...line.slice(0,68)].reduce((sum,c)=>sum+(/\d/.test(c)?Number(c):c==='-'?1:0),0)%10===Number(line[68]);
for(const s of snapshot.satellites){
 const flags=[];if(seen.has(s.noradId))flags.push('duplicate_id');seen.add(s.noradId);
 const meta=catalog.get(s.noradId);if(!meta)flags.push('satcat_unmatched');
 if(meta?.DECAY_DATE)flags.push('catalog_reports_decay');
 if(!s.metadataSource)flags.push('classification_not_sourced_in_feed');
 if(s.lon < -180 || s.lon >=180)flags.push('unnormalized_longitude');
 let ageDays=null,deltaM=null;
 const identity=Number(s.tleLine1?.slice(2,7))===s.noradId&&Number(s.tleLine2?.slice(2,7))===s.noradId;
 if(!identity)flags.push('tle_identity_mismatch');
 if(!checksum(s.tleLine1)||!checksum(s.tleLine2))flags.push('tle_checksum_invalid');
 try {
 const rec=twoline2satrec(s.tleLine1,s.tleLine2);ageDays=(now.getTime()-(rec.jdsatepoch-2440587.5)*86400000)/86400000;
 if(!Number.isFinite(ageDays))throw Error('epoch');
 if(ageDays>14)flags.push('expired_elements');else if(ageDays>3)flags.push('aged_elements');else if(ageDays < -1)flags.push('future_elements');
 const time=new Date(s.positionTimestamp);if(!Number.isFinite(time.getTime())){flags.push('missing_position_epoch');}else{
 const state=propagate(rec,time);if(!state?.position||rec.error)throw Error('propagation');
 const fixed=eciToEcf(state.position,gstime(time));const reported=geodeticToEcf({latitude:s.lat*Math.PI/180,longitude:s.lon*Math.PI/180,height:s.altitudeKm});
 deltaM=1000*Math.hypot(fixed.x-reported.x,fixed.y-reported.y,fixed.z-reported.z);
 if(!Number.isFinite(deltaM))throw Error('nonfinite');
 if(deltaM>100)flags.push('implementation_difference_over_100m');
 }
 }catch{flags.push('propagation_unavailable');}
 const withheld=flags.some(f=>["catalog_reports_decay","expired_elements","future_elements","propagation_unavailable","tle_identity_mismatch","tle_checksum_invalid"].includes(f));
 details.push({withheldFromCurrentDisplay:withheld,noradId:s.noradId,name:s.name,satcatType:meta?.OBJECT_TYPE??null,feedType:s.objectType??null,ageDays,implementationDifferenceM:deltaM,flags});
}
const referenceScope=[...catalog.values()].filter(m=>m.ORBIT_CENTER==='EA'&&m.ORBIT_TYPE==='ORB'&&!m.DECAY_DATE);
const missing=referenceScope.filter(m=>!seen.has(Number(m.NORAD_CAT_ID))).map(m=>({noradId:Number(m.NORAD_CAT_ID),name:m.OBJECT_NAME,type:m.OBJECT_TYPE,dataStatus:m.DATA_STATUS_CODE}));
const deltas=details.map(r=>r.implementationDifferenceM).filter(Number.isFinite).sort((a,b)=>a-b);
const counts={};for(const row of details)for(const flag of row.flags)counts[flag]=(counts[flag]??0)+1;
const types={};for(const row of details)types[row.satcatType??'UNMATCHED']=(types[row.satcatType??'UNMATCHED']??0)+1;
const eligible=details.filter(r=>!r.withheldFromCurrentDisplay);
const eligibleDeltas=eligible.map(r=>r.implementationDifferenceM).filter(Number.isFinite).sort((a,b)=>a-b);
const report={schema:'aurora-catalog-audit-v1',capturedAt:snapshot.capturedAt,generatedAt:new Date().toISOString(),metadataSource:'https://celestrak.org/pub/satcat.csv',metadataSHA256:createHash('sha256').update(metadata).digest('hex'),scope:'All objects in supplied Aurora snapshot; SATCAT coverage denominator is undecayed Earth-orbit objects, not a claim of available GP data.',limitations:'Implementation consistency only: backend positions vs satellite.js using identical elements and position timestamps. Shared source/model errors remain undetected. No radar/optical residuals, covariance validation, or independent truth positions. 100m is a software diagnostic threshold, not an operational accuracy bound.',summary:{objects:details.length,withheld:details.length-eligible.length,eligibleCompared:eligibleDeltas.length,eligibleMaxDifferenceM:eligibleDeltas.at(-1)??null,eligibleOver100m:eligible.filter(r=>r.implementationDifferenceM>100).length,satcatMatches:details.filter(r=>r.satcatType).length,types,flags:counts,compared:deltas.length,p50DifferenceM:deltas[Math.floor(deltas.length*.5)]??null,p99DifferenceM:deltas[Math.floor(deltas.length*.99)]??null,maxDifferenceM:deltas.at(-1)??null,satcatEarthOrbitObjects:referenceScope.length,missingObjects:missing.length,missingSixDigitObjects:missing.filter(r=>r.noradId>=100000).length},objects:details,missingObjects:missing};
fs.writeFileSync(outputPath,JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary,null,2));
