import { json2satrec, type OMMJsonObject, type SatRec } from 'satellite.js';
export function parseOMM(value:unknown,expectedId?:number):{omm:OMMJsonObject;record:SatRec} {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Expected OMM JSON object');
 const o={...value} as Record<string,unknown>;
 for(const [key,expected] of Object.entries({CENTER_NAME:'EARTH',REF_FRAME:'TEME',TIME_SYSTEM:'UTC',MEAN_ELEMENT_THEORY:'SGP4'}))if(o[key]!==undefined&&o[key]!==''&&o[key]!==expected)throw new Error(`Unsupported ${key}`);
 const numeric=['NORAD_CAT_ID','MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT'];
 for(const key of numeric){const v=o[key];if((typeof v!=='number'&&typeof v!=='string')||String(v).trim()===''||!Number.isFinite(Number(v)))throw new Error(`Missing / invalid ${key}`);o[key]=Number(v);}
 const id=o.NORAD_CAT_ID as number;
 if(!Number.isSafeInteger(id)||id<=0||id>999999999||expectedId!==undefined&&id!==expectedId)throw new Error('OMM catalog ID mismatch');
 if(typeof o.EPOCH!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(o.EPOCH)||!Number.isFinite(Date.parse(o.EPOCH.endsWith('Z')?o.EPOCH:o.EPOCH+'Z')))throw new Error('Invalid OMM UTC epoch');
 if(o.EPHEMERIS_TYPE!==undefined&&Number(o.EPHEMERIS_TYPE)!==0)throw new Error('Only SGP4 ephemeris type 0 supported');
 if(o.CCSDS_OMM_VERS!==undefined&&!String(o.CCSDS_OMM_VERS).startsWith('3.'))throw new Error('Unsupported OMM version');
 if((o.MEAN_MOTION as number)<=0||(o.MEAN_MOTION as number)>20||(o.ECCENTRICITY as number)<0||(o.ECCENTRICITY as number)>=0.9||(o.INCLINATION as number)<0||(o.INCLINATION as number)>180)throw new Error('OMM elements outside supported bounds');
 for(const key of ['RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY'])if((o[key] as number)<0||(o[key] as number)>=360)throw new Error(`Invalid ${key}`);
 o.OBJECT_NAME=typeof o.OBJECT_NAME==='string'?o.OBJECT_NAME:`NORAD ${id}`;o.OBJECT_ID=typeof o.OBJECT_ID==='string'?o.OBJECT_ID:'';o.ELEMENT_SET_NO=o.ELEMENT_SET_NO??0;
 // Normalize either supported UTC spelling to a single representation.
 o.EPOCH=o.EPOCH.replace(/Z$/,'');
 const omm=o as unknown as OMMJsonObject,record=json2satrec(omm);
 if(record.error!==0||!Number.isFinite(record.jdsatepoch)||record.no<=0)throw new Error('OMM SGP4 initialization failed');
 return {omm,record};
}
