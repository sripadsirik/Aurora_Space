import { useEffect, useState } from "react";
import type { Driver, Race } from "./data";

interface Sector {
  Value?: string;
}
interface Line {
  InPit?: boolean;
  Stopped?: boolean;
  Retired?: boolean;
  Position?: string;
  LastLapTime?: Sector;
  BestLapTime?: Sector;
  Sectors?: Record<string, Sector>;
}
interface Anchor {
  fraction: number;
  at: number;
  seconds: number;
}
export interface TimingCar extends Driver {
  rank?: string;
  lap?: string;
  stationary: boolean;
  anchor?: Anchor;
}
export interface FreeTiming {
  status: string;
  session: string;
  cars: TimingCar[];
}
const idle: FreeTiming = {
  status: "Waiting for the timing feed",
  session: "",
  cars: [],
};
function seconds(value?: string) {
  if (!value || !/^\d{1,3}(?::\d{2})?(?:\.\d+)?$/.test(value)) return 0;
  return value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}
export function estimateProgress(car: TimingCar, now: number) {
  const anchor = car.anchor;
  if (!anchor || car.stationary) return null;
  const age = (now - anchor.at) / 1000;
  if (age < 0 || age > anchor.seconds * 0.6) return null;
  return (anchor.fraction + Math.min(1 / 3, age / anchor.seconds)) % 1;
}
export function circuitSampler(points: number[][]) {
  const lengths = [0],
    cos = Math.cos((points[0][1] * Math.PI) / 180);
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          (points[i][0] - points[i - 1][0]) * cos,
          points[i][1] - points[i - 1][1],
        ),
    );
  return (fraction: number): [number, number] => {
    const distance = (fraction % 1) * lengths[lengths.length - 1];
    let low = 1,
      high = lengths.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (lengths[mid] < distance) low = mid + 1;
      else high = mid;
    }
    const portion =
      (distance - lengths[low - 1]) / (lengths[low] - lengths[low - 1] || 1);
    return [0, 1].map(
      (k) =>
        points[low - 1][k] + portion * (points[low][k] - points[low - 1][k]),
    ) as [number, number];
  };
}
export function useFreeTiming(race: Race | undefined, enabled: boolean) {
  const [state, setState] = useState<FreeTiming>(idle);
  useEffect(() => {
    setState(idle);
    if (!race || !enabled) return;
    const selectedRace = race;
    let closed = false,
      socket: WebSocket | undefined,
      retry: ReturnType<typeof setTimeout>,
      lastMessage = 0;
    const connect = () => {
      const cars = new Map<number, TimingCar>();
      const flags = new Map<
        number,
        Pick<Line, "InPit" | "Retired" | "Stopped">
      >();
      let matches = false,
        session = "",
        running = false,
        red = false,
        sessionKey = 0;
      const publish = () =>
        setState({
          session: matches ? session : "",
          cars: matches && running && !red ? [...cars.values()] : [],
          status: !matches
            ? "Waiting for this Grand Prix"
            : !running
              ? "Waiting for an active session"
              : red
                ? "Red flag · positions paused"
                : "Live timing · estimated car positions",
        });
      // Only public timing topics. Position and car telemetry are separate paid channels.
      const ws = new WebSocket("wss://livetiming.formula1.com/signalrcore");
      socket = ws;
      lastMessage = Date.now();
      const send = (msg: unknown) => ws.send(JSON.stringify(msg) + "\x1e");
      ws.onopen = () => send({ protocol: "json", version: 1 });
      function update(topic: string, data: any, at: number, initial: boolean) {
        if (!data || typeof data !== "object") return;
        if (topic === "SessionInfo") {
          if (data.Key && sessionKey !== data.Key) {
            sessionKey = data.Key;
            cars.clear();
            flags.clear();
            running = false;
            red = false;
            session = "";
            matches = false;
          }
          if (data.Meeting && data.StartDate) {
            const sessionDay = Date.parse(data.StartDate.slice(0, 10));
            const daysBeforeRace =
              (Date.parse(selectedRace.date) - sessionDay) / 86400000;
            // The calendar uses UTC, while SessionInfo gives a circuit-local date.
            // Event dates also match weekends whose names differ between providers.
            matches =
              String(data.StartDate).startsWith(selectedRace.season) &&
              (data.Meeting.Name === selectedRace.raceName ||
                (daysBeforeRace >= -1 && daysBeforeRace <= 4));
          }
          if (data.Name) session = data.Name;
          if (data.SessionStatus) running = data.SessionStatus === "Started";
        }
        if (topic === "SessionStatus" && data.Status)
          running = data.Status === "Started";
        if (topic === "TrackStatus" && data.Status) red = data.Status === "5";
        if (!matches || !running || red) {
          for (const car of cars.values()) delete car.anchor;
        }
        if (topic === "DriverList")
          for (const d of Object.values(data) as any[]) {
            if (!d?.RacingNumber) continue;
            const id = Number(d.RacingNumber),
              old = cars.get(id);
            cars.set(id, {
              ...old,
              driver_number: id,
              full_name: d.FullName ?? old?.full_name ?? String(id),
              name_acronym: d.Tla ?? old?.name_acronym ?? String(id),
              team_colour: d.TeamColour ?? old?.team_colour ?? "ffffff",
              team_name: d.TeamName ?? old?.team_name ?? "",
              stationary: old?.stationary ?? false,
            });
          }
        if (topic === "TimingData")
          for (const [id, line] of Object.entries(data.Lines || {}) as [
            string,
            Line,
          ][]) {
            const car = cars.get(+id);
            if (!car) continue;
            if (line.Position) car.rank = line.Position;
            if (line.LastLapTime?.Value) car.lap = line.LastLapTime.Value;
            if (!car.lap && line.BestLapTime?.Value)
              car.lap = line.BestLapTime.Value;
            const status = flags.get(+id) ?? {};
            for (const key of ["InPit", "Retired", "Stopped"] as const) {
              if (line[key] !== undefined) status[key] = line[key];
            }
            flags.set(+id, status);
            car.stationary = !!(
              status.InPit ||
              status.Retired ||
              status.Stopped
            );
            if (car.stationary) delete car.anchor;
            const lap = seconds(car.lap);
            if (
              initial ||
              !matches ||
              !running ||
              red ||
              car.stationary ||
              !Number.isFinite(at)
            )
              continue;
            for (const [i, sector] of Object.entries(line.Sectors || {})) {
              if (!["0", "1", "2"].includes(i) || !seconds(sector?.Value))
                continue;
              const pace = lap || 3 * seconds(sector.Value);
              if (pace < 40 || pace > 300 || (car.anchor && at < car.anchor.at))
                continue;
              car.anchor = {
                fraction: ((Number(i) + 1) % 3) / 3,
                at,
                seconds: pace,
              };
            }
          }
      }
      ws.onmessage = (e) => {
        if (closed || ws !== socket || typeof e.data !== "string") return;
        lastMessage = Date.now();
        for (const record of e.data.split("\x1e").filter(Boolean)) {
          let m;
          try {
            m = JSON.parse(record);
          } catch {
            continue;
          }
          if (m.error || m.type === 7) {
            ws.close();
            return;
          }
          if (!m.type) {
            send({
              type: 1,
              invocationId: "1",
              target: "Subscribe",
              arguments: [
                [
                  "SessionInfo",
                  "SessionStatus",
                  "TrackStatus",
                  "DriverList",
                  "TimingData",
                  "Heartbeat",
                ],
              ],
            });
            continue;
          }
          if (m.type === 3 && m.result) {
            for (const t of [
              "SessionInfo",
              "SessionStatus",
              "TrackStatus",
              "DriverList",
              "TimingData",
            ])
              update(t, m.result[t], 0, true);
            publish();
          }
          if (
            m.type === 1 &&
            m.target?.toLowerCase() === "feed" &&
            Array.isArray(m.arguments)
          ) {
            const [topic, delta, stamp] = m.arguments;
            update(topic, delta, Date.parse(stamp), false);
            publish();
          }
        }
      };
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        if (closed) return;
        setState({
          ...idle,
          status: "Timing connection interrupted · reconnecting",
        });
        retry = setTimeout(connect, 5000);
      };
    };
    connect();
    // SignalR expects client pings even while the server is sending timing data.
    const ping = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: 6 }) + "\x1e");
    }, 15000);
    const watchdog = setInterval(() => {
      if (Date.now() - lastMessage > 45000) socket?.close();
    }, 5000);
    return () => {
      closed = true;
      clearInterval(watchdog);
      clearInterval(ping);
      clearTimeout(retry);
      socket?.close();
    };
  }, [race, enabled]);
  return state;
}
