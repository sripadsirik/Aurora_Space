import { describe, expect, it } from "vitest";
import { mergeCameraFeeds, parsePublicCameras, streetCameraName } from "./publicCameras";
import { filterCameras } from "./cameraNetworks";
import { chicagoCameras } from "./chicagoCameras";

const illinois = (overrides = {}) => ({ attributes: {
  OBJECTID: 3339, CameraLocation: "IL 21 at Inverrary", CameraDirection: "N",
  SnapShot: "https://www.lakecountypassage.com/snapshots/IL_21_@_Inverrary_cctv_North_Leg.jpg",
  WarningAge: "false", TooOld: "false", AgeInMinutes: "3", ...overrides,
}, geometry: { x: -87.91899109, y: 42.16080856 } });

describe("public camera networks", () => {
  it("names the requested intersection by street and direction, preserving publisher freshness", () => {
    const cameras = parsePublicCameras({ features: [illinois(), illinois({ OBJECTID: 3340, CameraDirection: "S", TooOld: "true" })] }, "illinois-3");
    expect(cameras[0]).toMatchObject({ name: "Milwaukee Ave (IL 21) & Inverrary Ln · North view", source: "Lake County PASSAGE / IDOT", observedAt: null, reportedAgeMinutes: 3, imageStale: false });
    expect(cameras[1].imageStale).toBe(true);
    expect(filterCameras(cameras, "illinois", "inverrary")).toHaveLength(2);
    expect(filterCameras(cameras, "illinois", "deerfield")).toHaveLength(2);
    expect(filterCameras(cameras, "illinois", "uiuc")).toHaveLength(0);
    expect(streetCameraName("I-88 at Farnsworth", "NONE")).toBe("I-88 & Farnsworth");
  });
  it("rejects unsafe camera images and invalid locations without dropping valid cameras", () => {
    const cameras = parsePublicCameras({ features: [null, illinois(), illinois({ SnapShot: "https://www.lakecountypassage.com.evil.example/cam.jpg" }), illinois({ SnapShot: "javascript:alert(1)" }), { ...illinois(), geometry: { x: 200, y: 100 } }] }, "illinois-0");
    expect(cameras).toHaveLength(1);
    expect(() => parsePublicCameras({ error: {} }, "illinois-0")).toThrow();
  });
  it("does not treat London catalog modification times as image capture times", () => {
    const properties = [{ key: "available", value: "true" }, { key: "imageUrl", value: "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/1.jpg", modified: "2026-11-05T12:00:00Z" }];
    const cameras = parsePublicCameras([null, { id: "1", commonName: "A406 & High Road", lat: 51.5, lon: 0, additionalProperties: properties }], "london");
    expect(cameras).toHaveLength(1);
    expect(cameras[0].observedAt).toBeNull();
    expect(parsePublicCameras([{ id: "1", lat: 51.5, lon: 0, additionalProperties: [{ key: "available", value: "false" }] }], "london")).toEqual([]);
  });
  it("loads operating Finland presets and NSW road names", () => {
    const cameras = parsePublicCameras({ features: [{ geometry: { coordinates: [24, 60] }, properties: { name: "Route 51", collectionStatus: "GATHERING", presets: [{ id: "C0150301", inCollection: true }, { id: "C0150302", inCollection: false }] } }] }, "finland");
    expect(cameras).toHaveLength(1);
    expect(cameras[0].image).toBe("https://weathercam.digitraffic.fi/C0150301.jpg");
    expect(parsePublicCameras({ features: [{ id: "nsw1", geometry: { coordinates: [151.1, -34] }, properties: { title: "5 Ways (Miranda)", href: "https://webcams.transport.nsw.gov.au/livetraffic-webcams/cameras/5_ways_miranda.jpeg" } }] }, "nsw")[0].name).toBe("5 Ways (Miranda)");
  });
  it("ignores out-of-service Caltrans cameras and preserves coordinate units", () => {
    const camera = { index: "1", inService: "true", location: { latitude: "37.8", longitude: "-122.2", locationName: "I-580 & SR-24" }, imageData: { static: { currentImageURL: "https://cwwp2.dot.ca.gov/camera.jpg" } } };
    const cameras = parsePublicCameras({ data: [null, { cctv: camera }, { cctv: { ...camera, inService: "false" } }] }, "california-4");
    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toMatchObject({ lat: 37.8, lon: -122.2, observedAt: null });
  });
  it("keeps published HLS streams and rejects lookalike or non-HTTPS video hosts", () => {
    const make = (streamingVideoURL: string) => ({ cctv: { index: "1", inService: "true",
      location: { latitude: "37.8", longitude: "-122.2", locationName: "I-580" },
      imageData: { streamingVideoURL, static: { currentImageURL: "https://cwwp2.dot.ca.gov/camera.jpg" } } } });
    const url = "https://wzmedia.dot.ca.gov/D4/W580_JWO_24_IC.stream/playlist.m3u8";
    expect(parsePublicCameras({ data: [make(url)] }, "california-4")[0].video).toEqual({ kind: "hls", url });
    for (const bad of ["http://wzmedia.dot.ca.gov/a.m3u8", "https://wzmedia.dot.ca.gov.evil.example/a.m3u8", "https://user@wzmedia.dot.ca.gov/a.m3u8"]) {
      const result = parsePublicCameras({ data: [make(bad)] }, "california-4");
      expect(result).toHaveLength(1);
      expect(result[0].video).toBeUndefined();
    }
  });
  it("adds direct PASSAGE views without duplicating mirrored images or inventing capture times", () => {
    const direct = parsePublicCameras([null, { id: "123", lastUpdated: Date.now(),
      location: { latitude: 42.152809, longitude: -87.835487, overrideLocation: "IL 43 @ Lake Cook" },
      approaches: { approach: [null, { direction: "north", filename: "IL_43_@_Lake_Cook_(N).jpg" },
        { direction: "south", filename: "IL_43_@_Lake_Cook_S.jpg" }, { filename: "../private.jpg" }] } }], "illinois-passage");
    expect(direct).toHaveLength(2);
    expect(direct[0]).toMatchObject({ observedAt: null, source: "Lake County PASSAGE" });
    expect(filterCameras(direct, "illinois", "deerfield")).toHaveLength(2);
    const mirror = { ...direct[0], id: "camera:illinois:1", image: "https://www.lakecountypassage.com/snapshots/IL_43_@_Lake_Cook_(N).jpg", reportedAgeMinutes: 2 };
    expect(mergeCameraFeeds([mirror, ...direct])).toEqual([mirror, direct[1]]);
    expect(() => parsePublicCameras({ error: "unavailable" }, "illinois-passage")).toThrow();
  });
  it("distinguishes road coverage from nearby cameras and includes Chicago live views", () => {
    const roads = parsePublicCameras({ features: [
      { ...illinois({ CameraLocation: "Eola / Liberty" }), geometry: { x: -88.245, y: 41.769 } },
      { ...illinois({ OBJECTID: 42, CameraLocation: "I-88 at Farnsworth" }), geometry: { x: -88.280, y: 41.801 } },
    ] }, "illinois-1");
    expect(filterCameras(roads, "illinois", "eola")).toHaveLength(1);
    expect(filterCameras(roads, "illinois", "new-york")).toEqual([]);
    expect(filterCameras(roads, "illinois", "mccoy")).toEqual([]);
    expect(filterCameras(chicagoCameras, "illinois", "willis").some(c => c.id.endsWith("fox32-willis"))).toBe(true);
    expect(filterCameras(chicagoCameras, "illinois", "wacker").some(c => c.id.endsWith("fox32-river"))).toBe(true);
  });
});
