export interface Aircraft {
  id: string;
  name: string;
  registration: string;
  model: string;
  lat: number;
  lon: number;
  altitudeM: number;
  altitudeKind: string;
  speed: number | null;
  heading: number | null;
  military: boolean;
  observedAt: number;
}
export interface Launch {
  id: string;
  name: string;
  rocket: string;
  provider: string;
  net: string;
  precision: string;
  status: string;
  lat: number | null;
  lon: number | null;
  pad: string;
  description: string;
  webcast: string | null;
  windowStart: string;
  windowEnd: string;
}
const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const coord = (v: unknown, max: number): number | null =>
  num(v) && Math.abs(v) <= max ? v : null;
export function parseAircraft(data: any): Aircraft[] {
  if (!Array.isArray(data?.ac) || !num(data.now))
    throw new Error("Invalid aircraft response");
  return data.ac
    .flatMap((a: any): Aircraft[] => {
      const lat = coord(a.lat, 90),
        lon = coord(a.lon, 180);
      if (
        typeof a.hex !== "string" ||
        lat === null ||
        lon === null ||
        !num(a.seen_pos) ||
        a.seen_pos < 0 ||
        a.seen_pos > 60
      )
        return [];
      const altitude = num(a.alt_geom)
        ? a.alt_geom
        : num(a.alt_baro)
          ? a.alt_baro
          : null;
      if (altitude === null) return [];
      return [
        {
          id: a.hex,
          name: String(a.flight || a.r || a.hex).trim(),
          registration: String(a.r || ""),
          model: String(a.t || "Unknown"),
          lat,
          lon,
          altitudeM: altitude * 0.3048,
          altitudeKind: num(a.alt_geom)
            ? "geometric"
            : "barometric approximation",
          speed: num(a.gs) ? a.gs : null,
          heading: num(a.track) ? a.track : null,
          military: (Number(a.dbFlags) & 1) === 1,
          observedAt: data.now - a.seen_pos * 1000,
        },
      ];
    })
    .slice(0, 5000);
}
export function parseWorldwideAircraft(data: any): Aircraft[] {
  if (!num(data?.time) || !(data.states === null || Array.isArray(data.states)))
    throw new Error("Invalid worldwide aircraft response");
  return (data.states ?? []).flatMap((s: any): Aircraft[] => {
    if (!Array.isArray(s) || typeof s[0] !== "string" || !num(s[3]) ||
        data.time - s[3] > 60 || s[3] - data.time > 5 ||
        coord(s[5], 180) === null || coord(s[6], 90) === null || s[8] === true)
      return [];
    const altitude = num(s[13]) ? s[13] : num(s[7]) ? s[7] : null;
    if (altitude === null) return [];
    return [{
      id: s[0], name: String(s[1] || s[0]).trim() || s[0], registration: "",
      model: "Type not supplied", lat: s[6], lon: s[5], altitudeM: altitude,
      altitudeKind: num(s[13]) ? "geometric" : "barometric approximation",
      speed: num(s[9]) ? s[9] / 0.514444 : null,
      heading: num(s[10]) ? s[10] : null,
      military: false, observedAt: s[3] * 1000,
    }];
  });
}
export function parseLaunches(data: any): Launch[] {
  if (!Array.isArray(data?.results)) throw new Error("Invalid launch response");
  return data.results
    .filter((l: any) => typeof l.id === "string" && typeof l.name === "string")
    .map((l: any) => ({
      id: l.id,
      name: l.name,
      rocket:
        l.rocket?.configuration?.full_name ||
        l.rocket?.configuration?.name ||
        "Rocket unspecified",
      provider: l.launch_service_provider?.name || "Unknown provider",
      net: l.net || "",
      precision: l.net_precision?.name || "Unconfirmed",
      status: l.status?.name || "Unknown",
      lat: coord(l.pad?.latitude, 90),
      lon: coord(l.pad?.longitude, 180),
      pad: l.pad?.location?.name || l.pad?.name || "Pad unspecified",
      description: l.mission?.description || "",
      webcast:
        l.vid_urls?.find(
          (v: any) => typeof v.url === "string" && /^https:\/\//.test(v.url),
        )?.url || null,
      windowStart: l.window_start || "",
      windowEnd: l.window_end || "",
    }));
}
export function countdown(net: string, now: number, status: string): string {
  if (
    /hold|scrub|tbd|tbc|to be determined|to be confirmed|success|failure|flight|landed/i.test(
      status,
    )
  )
    return status;
  const diff = Date.parse(net) - now;
  if (!Number.isFinite(diff)) return "Time unconfirmed";
  if (diff <= 0) return "Scheduled time passed · awaiting status";
  const s = Math.floor(diff / 1000);
  return `T− ${Math.floor(s / 86400)}d ${String(Math.floor(s / 3600) % 24).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
