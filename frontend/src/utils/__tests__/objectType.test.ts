import { expect, it } from "vitest";
import { objectClassification } from "../objectType";
import { mockSatellites } from "../../data/mock/satellites";
it("identifies named debris without claiming an owner or catalog type", () => {
  expect(objectClassification({...mockSatellites[0],name:"FENGYUN 1C DEB",owner:""})).toEqual({label:"Debris",source:"Inferred from catalog name"});
});
it("uses explicit catalog classification and leaves missing metadata unknown", () => {
  expect(objectClassification({...mockSatellites[0],name:"OBJECT",objectType:"DEBRIS"}).label).toBe("Debris");
  expect(objectClassification({...mockSatellites[0],name:"OBJECT",owner:""}).label).toBe("Unknown");
});
