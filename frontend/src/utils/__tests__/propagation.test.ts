import { describe, expect, it } from "vitest";
import { Cartesian3 } from "cesium";
import { gstime } from "satellite.js";
import { elementEpoch, propagatedPosition, predictedOrbit, orbitalElementStatus, orbitDescription } from "../propagation";
import { mockSatellites } from "../../data/mock/satellites";

// Vallado SGP4 verification case 00005 (AIAA 2006-6753).
const satellite = { ...mockSatellites[0], noradId: 5,
  tleLine1: "1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753",
  tleLine2: "2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667" };

describe("real TLE propagation", () => {
  it("matches the published epoch state vector to within 30 metres after Earth rotation", () => {
    const epoch = elementEpoch(satellite)!;
    const position = propagatedPosition(satellite, epoch)!;
    const theta = gstime(epoch);
    const expected = new Cartesian3(
      (7022.46529266 * Math.cos(theta) - 1400.08296755 * Math.sin(theta)) * 1000,
      (-7022.46529266 * Math.sin(theta) - 1400.08296755 * Math.cos(theta)) * 1000,
      0.03995155 * 1000);
    expect(Cartesian3.distance(position, expected)).toBeLessThan(30);
  });
  // Public Java verification output in CelesTrak's AIAA-2006-6753.zip.
  it.each([
    [360, -7154.03120202, -3783.17682504, -3536.19412294],
    [720, -7134.59340119, 6531.68641334, 3260.27186483],
    [1440, -938.55923943, -6268.18748831, -4294.02924751]
  ])("matches the published SGP4 trajectory at %i minutes", (minutes, x, y, z) => {
    const date = new Date(elementEpoch(satellite)!.getTime() + minutes * 60000);
    const theta = gstime(date);
    const expected = new Cartesian3((x * Math.cos(theta) + y * Math.sin(theta)) * 1000,
      (-x * Math.sin(theta) + y * Math.cos(theta)) * 1000, z * 1000);
    expect(Cartesian3.distance(propagatedPosition(satellite, date)!, expected)).toBeLessThan(30);
  });
  it("distinguishes old elements from a fresh position-feed timestamp", () => {
    const date = new Date(elementEpoch(satellite)!.getTime() + 12 * 86400000);
    expect(orbitalElementStatus(satellite, date)).toContain("Aged TLE · 12.0d");
    expect(orbitalElementStatus(satellite, new Date(date.getTime() + 3 * 86400000))).toContain("path hidden");
  });
  it("moves with time and leaves an open Earth-fixed trajectory", () => {
    const epoch = elementEpoch(satellite)!;
    const p1 = propagatedPosition(satellite, epoch)!;
    const p2 = propagatedPosition(satellite, new Date(epoch.getTime()+60000))!;
    expect(Cartesian3.distance(p1,p2)).toBeGreaterThan(100000);
    const path = predictedOrbit(satellite,epoch);
    expect(path).toHaveLength(181);
    expect(Cartesian3.distance(path[0],path.at(-1)!)).toBeGreaterThan(1000000);
  });
  it("never invents an orbit for missing, malformed or stale elements", () => {
    expect(predictedOrbit(mockSatellites[0])).toEqual([]);
    expect(propagatedPosition({...satellite,tleLine1:'invalid'},elementEpoch(satellite)!)).toBeNull();
    expect(propagatedPosition(satellite,new Date('2026-10-11'))).toBeNull();
  });
});

it("keeps NORAD 31029 aligned with KeepTrack's published elements at identical UTC", () => {
  const base = {...satellite, noradId:31029,
    tleLine1:"1 31029U 99025BDX 26296.24052856  .00000557  00000+0  20416-3 0  9999",
    tleLine2:"2 31029  98.8369 205.7117 0087418 229.3386 283.1512 14.34838306 22998"};
  const keepTrack = {...base,tleLine1:"1 31029U 99025BDX 26296.24052855  .00000557  00000+0  20416-3 0  9998"};
  const utc = new Date("2026-10-23T18:19:59Z");
  expect(Cartesian3.distance(propagatedPosition(base,utc)!,propagatedPosition(keepTrack,utc)!)).toBeLessThan(7);
});

it("withholds decayed objects and mismatched catalog identities", () => {
 const at=elementEpoch(satellite)!;
 expect(propagatedPosition({...satellite,decayDate:"2000-06-27"},at)).toBeNull();
 expect(propagatedPosition({...satellite,noradId:31029},at)).toBeNull();
 expect(propagatedPosition(satellite,new Date(at.getTime()-2*86400000))).toBeNull();
});

it("draws BEIDOU IGSO around Earth in orbital space instead of its Earth-fixed analemma", () => {
 const igso={...satellite,noradId:36828,name:"BEIDOU-2 IGSO-1",tleLine1:"1 36828U 10036A   26296.54764706 -.00000066  00000+0  00000+0 0  9992",tleLine2:"2 36828  54.3055 161.8024 0056075 219.9333 315.4922  1.00278162 59384"};
 const at=new Date("2026-10-24T13:20:55Z");
 const orbit=predictedOrbit(igso,at,240,"orbital");
 const earthFixed=predictedOrbit(igso,at,240,"earth-fixed");
 expect(orbit).toHaveLength(241);
 expect(Math.min(...orbit.map(p=>p.x))).toBeLessThan(-30e6);
 expect(Math.max(...orbit.map(p=>p.x))).toBeGreaterThan(30e6);
 expect(Math.max(...earthFixed.map(p=>p.x))-Math.min(...earthFixed.map(p=>p.x))).toBeLessThan(30e6);
 expect(orbitDescription(igso)).toBe("Near-geosynchronous · inclined");
 // The same sample at 'now' agrees in both frames after the view-time rotation.
 const p=orbit[60],g=gstime(at);const rotated=new Cartesian3(p.x*Math.cos(g)+p.y*Math.sin(g),-p.x*Math.sin(g)+p.y*Math.cos(g),p.z);
 expect(Cartesian3.distance(rotated,propagatedPosition(igso,at)!)).toBeLessThan(0.01);
});
