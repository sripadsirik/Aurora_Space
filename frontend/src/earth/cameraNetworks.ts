import type { TrafficCamera } from "./data";

export const cameraNetworks = [
  { id: "illinois", name: "Illinois & Midwest", source: "IDOT / Travel Midwest / Lake County PASSAGE", url: "https://www.gettingaroundillinois.com/", lat: 41.88, lon: -87.63, feeds: [...Array.from({ length: 4 }, (_, i) => `illinois-${i}`), "illinois-passage"] },
  { id: "california", name: "California, USA", source: "Caltrans", url: "https://dot.ca.gov/programs/traffic-operations/traveler-information/cwwp", lat: 37.77, lon: -122.42, feeds: Array.from({ length: 12 }, (_, i) => `california-${i + 1}`) },
  { id: "london", name: "London, UK", source: "Powered by TfL Open Data", url: "https://tfl.gov.uk/info-for/open-data-users/", lat: 51.5074, lon: -0.1278, feeds: ["london"] },
  { id: "finland", name: "Finland", source: "Fintraffic / Digitraffic", url: "https://www.digitraffic.fi/en/road-traffic/", lat: 60.17, lon: 24.94, feeds: ["finland"] },
  { id: "nsw", name: "New South Wales, Australia", source: "Transport for NSW", url: "https://www.livetraffic.com/help", lat: -33.87, lon: 151.21, feeds: ["nsw"] },
  { id: "singapore", name: "Singapore", source: "LTA / data.gov.sg", url: "https://data.gov.sg/datasets?topics=transport", lat: 1.3521, lon: 103.8198, feeds: ["singapore"] },
];

export const illinoisPlaces: { id: string; name: string; lat: number; lon: number; radiusKm: number; road?: string; note?: string }[] = [
  { id: "inverrary", name: "Milwaukee Ave & Inverrary Ln", lat: 42.16080856, lon: -87.91899109, radiusKm: 0.2 },
  { id: "deerfield", name: "Deerfield", lat: 42.1711, lon: -87.8445, radiusKm: 10 },
  { id: "naperville", name: "Naperville", lat: 41.7508, lon: -88.1535, radiusKm: 15 },
  { id: "aurora", name: "Aurora", lat: 41.7606, lon: -88.3201, radiusKm: 15 },
  { id: "chicago", name: "Chicago", lat: 41.8781, lon: -87.6298, radiusKm: 25 },
  { id: "wacker", name: "Wacker / Chicago River", lat: 41.887, lon: -87.633, radiusKm: 1.5, note: "Includes the public Chicago River scenic video. Its map position marks the viewing area; individual Wacker intersections are not guaranteed." },
  { id: "willis", name: "Willis Tower", lat: 41.8789, lon: -87.6359, radiusKm: 1, note: "Includes the official Willis Tower skyline video, plus nearby published road cameras." },
  { id: "eola", name: "Eola Road", lat: 41.779, lon: -88.244, radiusKm: 12, road: "eola" },
  { id: "new-york", name: "New York Street", lat: 41.759, lon: -88.245, radiusKm: 15, road: "new york", note: "No New York Street feed was found in the connected public catalog when checked November 5, 2026. Roadside cameras may not publish public images or video. Choose Aurora or Eola Road for nearby coverage." },
  { id: "mccoy", name: "McCoy Drive", lat: 41.746, lon: -88.245, radiusKm: 12, road: "mccoy", note: "No McCoy Drive feed was found in the connected public catalog when checked November 5, 2026. Choose Aurora or Naperville for nearby published cameras." },
  { id: "uic", name: "UIC · nearby roads", lat: 41.8722, lon: -87.6495, radiusKm: 5 },
  { id: "uiuc", name: "UIUC · nearby roads", lat: 40.102, lon: -88.2272, radiusKm: 20 },
];

export function cameraDistanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function filterCameras(cameras: TrafficCamera[], network: string, area: string) {
  const place = illinoisPlaces.find(p => p.id === area);
  const filtered = cameras.filter(c => (network === "all" || c.network === network) &&
    (!place || (cameraDistanceKm(c, place) <= place.radiusKm &&
      (!place.road || `${c.name} ${c.providerName ?? ""}`.toLowerCase().includes(place.road)))));
  return place ? filtered.sort((a, b) => cameraDistanceKm(a, place) - cameraDistanceKm(b, place)) : filtered;
}
