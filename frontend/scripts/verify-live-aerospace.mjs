import { chromium } from '@playwright/test';
import {writeFile, mkdir} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dir=fileURLToPath(new URL('../../docs/generated/aerospace/', import.meta.url));
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],samples=[];page.on('pageerror',e=>errors.push(e.message));
page.on('response',async r=>{if(r.url().includes('/api/aerospace/')&&r.ok()){const body=await r.json();samples.push({url:r.url(),receivedAt:Date.now(),...body});}});
try{
 await page.goto(process.env.AURORA_LIVE_URL || 'http://127.0.0.1:5173/');
 await page.waitForFunction(async()=>{const {useAuroraStore}=await import('/src/store/auroraStore.ts');return useAuroraStore.getState().satellites.length>1000;},{},{timeout:90000});
 await page.getByRole('button',{name:'↑ Rockets',exact:true}).click();
 await page.locator('.aerospace-row').first().waitFor({timeout:60000});
 await page.locator('.aerospace-row').first().click();
 await page.screenshot({path:dir+'/live-launches.png'});
 await page.getByRole('button',{name:'✈ Aircraft',exact:true}).click();
 await page.locator('.aerospace-row').first().waitFor({timeout:60000});
 await page.locator('.aerospace-row').first().click();
 await page.getByRole('button',{name:'Locate on globe ↗'}).click();
 // Wait for actual successive network responses, not fixture data.
 await page.waitForResponse(r=>r.url().includes('/aircraft/florida')&&r.ok(),{timeout:45000});
 await page.waitForResponse(r=>r.url().includes('/aircraft/florida')&&r.ok(),{timeout:45000});
 await page.screenshot({path:dir+'/live-aircraft.png'});
 const air=samples.filter(s=>s.url.includes('/aircraft/florida'));
 const first=air[0],last=air.at(-1);
 const old=new Map((first?.data.ac||[]).map(a=>[a.hex,a]));
 const changed=(last?.data.ac||[]).filter(a=>old.has(a.hex)&&Number.isFinite(a.lat)&&a.lat!==old.get(a.hex).lat);
 const launch=samples.find(s=>s.url.endsWith('/launches'));
 const satelliteState=await page.evaluate(async()=>{const {useAuroraStore}=await import('/src/store/auroraStore.ts');const s=useAuroraStore.getState();return {count:s.satellites.length,connected:s.isConnectedToBackend,feedTimes:s.feedLastUpdated};});
 const evidence={satelliteState,checkedAt:new Date().toISOString(),mocked:false,aircraftSnapshots:air.length,firstFetchedAt:first?.fetchedAt,lastFetchedAt:last?.fetchedAt,aircraftCount:last?.data.ac?.length,movedAircraft:changed.length,examples:changed.slice(0,3).map(a=>({id:a.hex,previous:{lat:old.get(a.hex).lat,lon:old.get(a.hex).lon},current:{lat:a.lat,lon:a.lon},positionAgeSeconds:a.seen_pos})),launchCount:launch?.data.results?.length,launches:launch?.data.results?.slice(0,5).map(l=>({name:l.name,net:l.net,status:l.status.name})),errors};
 await writeFile(dir+'/live-verification.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
 if(errors.length||!changed.length||!launch?.data.results?.length||satelliteState.count<1000||!satelliteState.feedTimes.satellites)throw new Error('Live verification failed');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:dir+'/live-mobile.png'});
}finally{await browser.close();}
