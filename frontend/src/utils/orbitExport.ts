import { elementEpoch, orbitalElements, propagatedPosition } from "./propagation";
import type { Satellite } from "../types/space";

export function orbitExport(satellite: Satellite, now = new Date()) {
  const record=orbitalElements(satellite);
  if(!record || !propagatedPosition(satellite,now)) throw new Error("A valid, unexpired TLE is required to export a trajectory");
  const periodMs=2*Math.PI/record.no*60000;
  const samples=Array.from({length:181},(_,i)=>{
    const time=new Date(now.getTime()+periodMs*(i/180-0.25));
    const position=propagatedPosition(satellite,time);
    if(!position)throw new Error("Trajectory crosses the TLE validity limit");
    return {utc:time.toISOString(),xM:position.x,yM:position.y,zM:position.z};
  });
  return {schema:"aurora-sgp4-trajectory-v1",noradId:satellite.noradId,name:satellite.name,generatedAt:now.toISOString(),
    source:"CelesTrak GP / NORAD TLE",elementEpoch:elementEpoch(satellite)!.toISOString(),tle:[satellite.tleLine1,satellite.tleLine2],
    model:"SGP4 / satellite.js",frame:"Earth-fixed via TEME + GMST (polar motion omitted)",units:"metres",window:"One revolution: 25% before and 75% after generatedAt",
    limitations:"Prediction from mean elements; no covariance, maneuver model or accuracy guarantee. Not an operational ephemeris.",samples};
}
