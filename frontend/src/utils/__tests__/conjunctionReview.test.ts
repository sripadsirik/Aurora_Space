import { describe, expect, it } from "vitest";
import { parseReviewImport, reviewAnnotations, reviewCompleteness, mergeReviewReports } from "../conjunctionReview";
const kvn = `CCSDS_CDM_VERS = 1.0
MESSAGE_ID = TEST-1
CREATION_DATE = 2026-10-23T12:00:00
TCA = 2026-10-24T12:00:00
MISS_DISTANCE = 125 [m]
RELATIVE_SPEED = 14000 [m/s]
COLLISION_PROBABILITY = 0
OBJECT = OBJECT1
OBJECT_DESIGNATOR = 1
OBJECT_NAME = FIRST
OBJECT = OBJECT2
OBJECT_DESIGNATOR = 2
OBJECT_NAME = SECOND`;
describe("CDM review import", () => {
  it("keeps zero probability distinct from unavailable probability and normalizes UTC", () => {
    const [r] = parseReviewImport(kvn,"test.cdm");
    expect(r.pc).toBe(0); expect(r.missDistanceM).toBe(125);
    expect(r.tca).toBe("2026-10-24T12:00:00.000Z");
    expect(reviewCompleteness(r).positionCovariances).toEqual([false,false]);
    expect(parseReviewImport(kvn.replace("COLLISION_PROBABILITY = 0", ""),"test.cdm")[0].pc).toBeNull();
  });
  it.each([
    kvn.replace("125 [m]","125 [km]"),
    kvn.replace("COLLISION_PROBABILITY = 0","COLLISION_PROBABILITY = 2"),
    kvn.replace("OBJECT_DESIGNATOR = 2","OBJECT_DESIGNATOR = 1"),
    kvn + "\nOBJECT_NAME = DUPLICATE"
  ])("rejects ambiguous or invalid report fields", text => expect(()=>parseReviewImport(text,"test.cdm")).toThrow());
  it("round trips report identity and analyst annotations", () => {
    const reports = parseReviewImport(kvn,"test.cdm");
    const key = `${reports[0].source}/${reports[0].id}`;
    const text = JSON.stringify({reports,notes:{[key]:"Request updated covariance"},reviewed:{[key]:true}});
    const restored = parseReviewImport(text,"review.json");
    expect(restored).toEqual(reports);
    expect(reviewAnnotations(text,restored)).toEqual({notes:{[key]:"Request updated covariance"},reviewed:{[key]:true}});
    expect(mergeReviewReports(reports,restored)).toHaveLength(1);
  });
  it("rejects malformed JSON field maps before rendering", () => {
    const reports = parseReviewImport(kvn,"test.cdm");
    (reports[0].objects[0].fields as Record<string,unknown>).X = 42;
    expect(()=>parseReviewImport(JSON.stringify({reports}),"bad.json")).toThrow();
  });
  it("does not silently replace a conflicting report", () => {
    const reports = parseReviewImport(kvn,"test.cdm");
    expect(()=>mergeReviewReports(reports,[{...reports[0],pc:0.1}])).toThrow(/Conflicting/);
  });
});
