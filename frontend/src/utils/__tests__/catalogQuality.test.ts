import { it, expect } from "vitest";
import { catalogQuality } from "../catalogQuality";
import { mockSatellites } from "../../data/mock/satellites";
it("keeps source-backed debris classification separate from prediction eligibility",()=>{
 const report=catalogQuality([{...mockSatellites[0],name:"UNNAMED FRAGMENT",objectType:"DEBRIS",metadataSource:"https://celestrak.org/pub/satcat.csv",metadataFetchedAt:"2026-10-24T00:00:00Z",decayDate:"2026-10-23",tleLine1:undefined,tleLine2:undefined}],new Date("2026-10-24T12:00:00Z"));
 expect(report.summary.authoritative).toBe(1);expect(report.summary.debris).toBe(1);expect(report.summary.withheld).toBe(1);
 expect(report.objects[0].issues).toContain("Catalog reports decay");
});
