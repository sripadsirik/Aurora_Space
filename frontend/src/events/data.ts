import { env } from "../utils/env";
export interface Stamp {
  date: string;
  time?: string;
}
export interface Race extends Stamp {
  season: string;
  round: string;
  raceName: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: { lat: string; long: string; locality: string; country: string };
  };
  FirstPractice?: Stamp;
  SecondPractice?: Stamp;
  ThirdPractice?: Stamp;
  SprintQualifying?: Stamp;
  SprintShootout?: Stamp;
  Sprint?: Stamp;
  Qualifying?: Stamp;
}
export interface Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  location: string;
  is_cancelled?: boolean;
}
export interface Driver {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  team_name: string;
  team_colour: string;
}
export interface Datum {
  date: string;
  driver_number: number;
  x?: number;
  y?: number;
  z?: number;
  speed?: number;
  throttle?: number;
  brake?: number;
  n_gear?: number;
  rpm?: number;
  position?: number;
  gap_to_leader?: number;
  interval?: number;
  lap_number?: number;
  lap_start?: number;
  lap_duration?: number;
  compound?: string;
  message?: string;
  air_temperature?: number;
  track_temperature?: number;
  rainfall?: number;
  duration?: number | number[];
  number_of_laps?: number;
  dnf?: boolean;
  dns?: boolean;
  dsq?: boolean;
}
export interface Track {
  coordinates: number[][];
  name: string;
}
export const stamp = (s: Stamp) =>
  s.date + (s.time ? "T" + s.time : "T00:00:00Z");
export function weekend(r: Race) {
  const items: [string, Stamp | undefined][] = [
    ["Practice 1", r.FirstPractice],
    ["Practice 2", r.SecondPractice],
    ["Practice 3", r.ThirdPractice],
    ["Sprint Qualifying", r.SprintQualifying || r.SprintShootout],
    ["Sprint", r.Sprint],
    ["Qualifying", r.Qualifying],
    ["Race", r],
  ];
  return items
    .filter((x): x is [string, Stamp] => !!x[1])
    .map(([name, s]) => ({ name, start: stamp(s), confirmed: !!s.time }))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
export function countdown(to: string, now: number) {
  const n = Math.max(0, Math.floor((Date.parse(to) - now) / 1000));
  return [
    Math.floor(n / 86400) + "d",
    String(Math.floor(n / 3600) % 24).padStart(2, "0") + "h",
    String(Math.floor(n / 60) % 60).padStart(2, "0") + "m",
    String(n % 60).padStart(2, "0") + "s",
  ].join(" ");
}
export function nextRace(races: Race[], now: number) {
  return races.find((r) => Date.parse(stamp(r)) > now);
}
export async function json(url: string, signal?: AbortSignal) {
  const r = await fetch(url, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const detail = typeof body.error === "string" ? body.error : "";
    const accessDenied =
      [401, 403].includes(r.status) || /HTTP (401|403)/.test(detail);
    throw new Error(
      accessDenied
        ? "Live access requires an OpenF1 subscription and a valid gateway access token"
        : `Data provider returned ${r.status}${detail ? " · " + detail : ""}`,
    );
  }
  return r.json();
}
export async function calendar(
  year: number,
  signal: AbortSignal,
): Promise<{ races: Race[]; snapshot: boolean }> {
  try {
    const v = await json(
      `https://api.jolpi.ca/ergast/f1/${year}.json?limit=100`,
      signal,
    );
    if (!Array.isArray(v?.MRData?.RaceTable?.Races))
      throw Error("Invalid calendar");
    return { races: v.MRData.RaceTable.Races, snapshot: false };
  } catch (e) {
    if (signal.aborted) throw e;
    try {
      const v = await json(
        `${import.meta.env.BASE_URL}events/calendar-${year}.json`,
        signal,
      );
      return { races: v.MRData.RaceTable.Races, snapshot: true };
    } catch {
      throw e;
    }
  }
}
// A single queue keeps public OpenF1 traffic below 30 requests/minute.
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
const cache = new Map<string, { at: number; data: unknown }>();
export function openF1<T>(
  resource: string,
  params: Record<string, string | number>,
  signal: AbortSignal,
  ttl = 60000,
): Promise<T[]> {
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  const key = resource + "?" + query;
  const existing = cache.get(key);
  if (existing && Date.now() - existing.at < ttl)
    return Promise.resolve(existing.data as T[]);
  const task = queue
    .catch(() => {})
    .then(async () => {
      signal.throwIfAborted();
      await new Promise((r) =>
        setTimeout(r, Math.max(0, 2100 - (Date.now() - lastRequest))),
      );
      signal.throwIfAborted();
      lastRequest = Date.now();
      let base = "https://api.openf1.org/v1/";
      if (env.VITE_WS_URL) {
        const u = new URL(env.VITE_WS_URL);
        u.protocol = u.protocol === "wss:" ? "https:" : "http:";
        u.pathname = "/api/events/f1/";
        u.search = "";
        base = u.toString();
      }
      const v = await json(base + key, signal);
      if (v.stale) throw Error(v.error || "Telemetry feed is stale");
      const data = Array.isArray(v) ? v : v.data;
      if (!Array.isArray(data)) throw Error("Invalid session response");
      if (cache.size > 150) cache.clear();
      const normalized =
        resource === "laps"
          ? data.map((d: Record<string, unknown>) => ({
              ...d,
              date: d.date_start,
            }))
          : data;
      cache.set(key, { at: Date.now(), data: normalized });
      return normalized as T[];
    });
  queue = task;
  return task;
}
export function atTime(data: Datum[], time: number, driver: number) {
  let result: Datum | undefined;
  for (const d of data) {
    if (d.driver_number === driver && Date.parse(d.date) <= time) result = d;
  }
  return result;
}
export function samplePosition(
  data: Datum[],
  time: number,
): [number, number] | null {
  if (
    !data.length ||
    time < Date.parse(data[0].date) ||
    time > Date.parse(data[data.length - 1].date) + 2000
  )
    return null;
  let lo = 0,
    hi = data.length - 1;
  while (lo < hi) {
    const m = Math.ceil((lo + hi) / 2);
    if (Date.parse(data[m].date) <= time) lo = m;
    else hi = m - 1;
  }
  const a = data[lo],
    b = data[lo + 1];
  if (a.x == null || a.y == null) return null;
  if (!b) return [a.x, a.y];
  const dt = Date.parse(b.date) - Date.parse(a.date);
  if (dt > 2500) return null;
  const t = Math.max(0, Math.min(1, (time - Date.parse(a.date)) / dt));
  return [a.x + (b.x! - a.x) * t, a.y + (b.y! - a.y) * t];
}
