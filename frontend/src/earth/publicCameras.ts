import { parseTrafficCameras, type TrafficCamera } from "./data";
import { cameraNetworks } from "./cameraNetworks";

export function streetCameraName(location: unknown, direction: unknown): string {
  const street = String(location || "Public road camera")
    .replace(/\bIL[ -]21\b/g, "Milwaukee Ave (IL 21)")
    .replace(/\bInverrary\b(?!\s+(?:Ln|Lane))/gi, "Inverrary Ln")
    .replace(/\s+(?:at|@)\s+/gi, " & ");
  const directions: Record<string, string> = { N: "North", S: "South", E: "East", W: "West", NE: "Northeast", NW: "Northwest", SE: "Southeast", SW: "Southwest" };
  const facing = directions[String(direction).toUpperCase()];
  return facing ? `${street} · ${facing} view` : street;
}

// Image URLs must belong to the publisher, not arbitrary URLs in upstream data.
function imageAllowed(image: unknown, network: string): image is string {
  if (typeof image !== "string") return false;
  try {
    const u = new URL(image);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    if (network === "illinois") return ["cctv.travelmidwest.com", "www.lakecountypassage.com"].includes(u.hostname);
    if (network === "california") return u.hostname === "cwwp2.dot.ca.gov";
    if (network === "london") return u.hostname === "s3-eu-west-1.amazonaws.com" && u.pathname.startsWith("/jamcams.tfl.gov.uk/");
    if (network === "nsw") return u.hostname === "webcams.transport.nsw.gov.au";
    if (network === "finland") return u.hostname === "weathercam.digitraffic.fi";
    return false;
  } catch { return false; }
}

// Accept only the streaming hosts published by Caltrans; never infer a stream
// by changing a snapshot URL or accepting arbitrary URLs from a catalog.
function caltransVideo(value: unknown): TrafficCamera["video"] {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password &&
        ["wzmedia.dot.ca.gov", "wzmedia1.dot.ca.gov", "wzmedia2.dot.ca.gov"].includes(url.hostname) &&
        url.pathname.endsWith(".m3u8")) return { kind: "hls", url: url.href };
  } catch { /* An invalid video does not discard a usable snapshot. */ }
}

export function parsePublicCameras(data: any, feed: string): TrafficCamera[] {
  const network = cameraNetworks.find(n => n.feeds.includes(feed));
  if (!network) throw Error("Unknown camera network");
  if (network.id === "singapore") return parseTrafficCameras(data).map(c => ({ ...c, network: network.id, source: network.source }));
  const rows: TrafficCamera[] = [];
  const add = (id: unknown, name: unknown, lat: unknown, lon: unknown, image: unknown) => {
    if (typeof id !== "string" || !id || typeof lat !== "number" || typeof lon !== "number" ||
        !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !imageAllowed(image, network.id)) return;
    const camera: TrafficCamera = { id: `camera:${network.id}:${id}`, name: String(name || id), lat, lon, image,
      // Catalog edit timestamps are not image capture timestamps.
      observedAt: null, network: network.id, source: network.source };
    rows.push(camera);
    return camera;
  };
  if (feed === "illinois-passage") {
    if (!Array.isArray(data)) throw Error("Invalid Lake County PASSAGE camera feed");
    for (const c of data) {
      if (!c?.id || !Array.isArray(c.approaches?.approach)) continue;
      const location = c.location;
      const name = location?.overrideLocation || [location?.route, location?.xstreet].filter(Boolean).join(" & ");
      for (const approach of c.approaches.approach) {
        if (typeof approach?.filename !== "string" || !approach.filename || /[\\/]/.test(approach.filename)) continue;
        const direction = String(approach.direction || "");
        const camera = add(`passage:${c.id}:${direction}`, `${streetCameraName(name, "")} · ${direction} view`,
          location?.latitude, location?.longitude,
          `https://www.lakecountypassage.com/snapshots/${encodeURIComponent(approach.filename)}`);
        if (camera) {
          camera.source = "Lake County PASSAGE";
          camera.providerName = name;
          camera.providerUrl = "https://www.lakecountypassage.com/";
          // lastUpdated describes the catalog entry, not the snapshot capture.
        }
      }
    }
  } else if (network.id === "london") {
    if (!Array.isArray(data)) throw Error("Invalid London camera feed");
    for (const c of data) {
      if (!c || !Array.isArray(c.additionalProperties)) continue;
      const props = Object.fromEntries(c.additionalProperties.filter((p: any) => p && typeof p.key === "string").map((p: any) => [p.key, p.value]));
      if (props.available === "true") add(c.id, c.commonName, c.lat, c.lon, props.imageUrl);
    }
  } else if (network.id === "california") {
    if (!Array.isArray(data?.data)) throw Error("Invalid Caltrans camera feed");
    for (const entry of data.data) {
      const c = entry?.cctv;
      if (c?.inService !== "true") continue;
      const l = c.location;
      if (l?.latitude == null || l?.longitude == null || l.latitude === "" || l.longitude === "") continue;
      const camera = add(`${feed}:${c.index}`, l.locationName, Number(l.latitude), Number(l.longitude), c.imageData?.static?.currentImageURL);
      if (camera) camera.video = caltransVideo(c.imageData?.streamingVideoURL);
    }
  } else {
    if (!Array.isArray(data?.features)) throw Error("Invalid camera feature collection");
    for (const c of data.features) {
      if (!c) continue;
      if (network.id === "illinois") {
        const a = c.attributes;
        if (!a?.SnapShot) continue;
        if (a.OBJECTID == null) continue;
        const camera = add(String(a.OBJECTID), streetCameraName(a.CameraLocation, a.CameraDirection), c.geometry?.y, c.geometry?.x, a.SnapShot);
        if (camera) {
          camera.providerName = String(a.CameraLocation || "");
          camera.imageStale = a.TooOld === "true" || a.WarningAge === "true";
          const age = a.AgeInMinutes === null || a.AgeInMinutes === "" ? NaN : Number(a.AgeInMinutes);
          if (Number.isFinite(age) && age >= 0) camera.reportedAgeMinutes = age;
          if (new URL(camera.image!).hostname === "www.lakecountypassage.com") camera.source = "Lake County PASSAGE / IDOT";
          try {
            const provider = new URL(a.ImgPath);
            if (provider.protocol === "https:" && provider.hostname === "travelmidwest.com" && !provider.username && !provider.password)
              camera.providerUrl = provider.href;
          } catch { /* Provider links are optional. */ }
        }
      } else if (network.id === "nsw") {
        add(c.id, c.properties?.title, c.geometry?.coordinates?.[1], c.geometry?.coordinates?.[0], c.properties?.href);
      } else if (network.id === "finland") {
        const p = c.properties;
        if (p?.collectionStatus !== "GATHERING") continue;
        for (const preset of Array.isArray(p.presets) ? p.presets : []) {
          if (preset?.inCollection === true && /^C\d+$/.test(preset.id))
            add(preset.id, `${p.name} · ${preset.id}`, c.geometry?.coordinates?.[1], c.geometry?.coordinates?.[0], `https://weathercam.digitraffic.fi/${preset.id}.jpg`);
        }
      }
    }
  }
  return rows;
}

export function mergeCameraFeeds(cameras: TrafficCamera[]): TrafficCamera[] {
  const seen = new Set<string>();
  return cameras.filter(camera => {
    // PASSAGE and the IDOT mirror publish the same images with different IDs
    // and URL escaping. Keep the first (IDOT has image-age metadata).
    let image = camera.image;
    try { if (image) image = decodeURIComponent(image); } catch { /* Keep malformed escaping distinct. */ }
    const key = image || camera.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
