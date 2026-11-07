export interface TrafficCamera {
  id: string;
  name: string;
  lat: number;
  lon: number;
  image?: string;
  video?: { kind: "hls" | "embed"; url: string };
  providerUrl?: string;
  coverageNote?: string;
  observedAt: string | null;
  network?: string;
  source?: string;
  providerName?: string;
  reportedAgeMinutes?: number;
  imageStale?: boolean;
}
export function parseTrafficCameras(data: any): TrafficCamera[] {
  if (!Array.isArray(data?.items)) throw Error("Invalid camera response");
  return data.items
    .flatMap((item: any) => (Array.isArray(item.cameras) ? item.cameras : []))
    .flatMap((c: any) => {
      if (
        typeof c.camera_id !== "string" ||
        !Number.isFinite(c.location?.latitude) ||
        !Number.isFinite(c.location?.longitude) ||
        Math.abs(c.location.latitude) > 90 ||
        Math.abs(c.location.longitude) > 180 ||
        !Number.isFinite(Date.parse(c.timestamp))
      )
        return [];
      try {
        const url = new URL(c.image);
        if (url.protocol !== "https:" || url.hostname !== "images.data.gov.sg")
          return [];
      } catch {
        return [];
      }
      return [
        {
          id: "camera:" + c.camera_id,
          name: "LTA traffic camera " + c.camera_id,
          lat: c.location.latitude,
          lon: c.location.longitude,
          image: c.image,
          observedAt: c.timestamp,
        },
      ];
    })
    .slice(0, 2000);
}
export function parseCoordinates(
  input: string,
): { lat: number; lon: number } | null {
  const pair = input.trim().split(",");
  if (pair.length !== 2 || pair.some((p) => !p.trim())) return null;
  const [lat, lon] = pair.map(Number);
  return Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
    ? { lat, lon }
    : null;
}
