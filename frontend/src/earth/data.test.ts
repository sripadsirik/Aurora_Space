import { expect, it } from "vitest";
import { parseCoordinates, parseTrafficCameras } from "./data";
it("accepts explicit coordinates worldwide and rejects malformed or out-of-range locations", () => {
  expect(parseCoordinates("51.5, -0.12")).toEqual({ lat: 51.5, lon: -0.12 });
  for (const q of ["London", "91,2", "2,181", ",2", "2,", "2,3,4"])
    expect(parseCoordinates(q)).toBeNull();
});
it("only accepts official traffic images with valid source coordinates and timestamps", () => {
  const camera = {
    camera_id: "1",
    timestamp: "2026-11-05T15:00:00+08:00",
    image: "https://images.data.gov.sg/test.jpg",
    location: { latitude: 1.3, longitude: 103.8 },
  };
  expect(
    parseTrafficCameras({
      items: [
        {
          cameras: [
            camera,
            { ...camera, image: "https://example.com/test.jpg" },
            { ...camera, image: "javascript:alert(1)" },
            { ...camera, timestamp: "bad" },
            { ...camera, location: { latitude: 91, longitude: 0 } },
          ],
        },
      ],
    }),
  ).toEqual([
    {
      id: "camera:1",
      name: "LTA traffic camera 1",
      lat: 1.3,
      lon: 103.8,
      image: camera.image,
      observedAt: camera.timestamp,
    },
  ]);
  expect(() => parseTrafficCameras({})).toThrow();
});
