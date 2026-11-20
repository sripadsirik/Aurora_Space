import { RaceVideo } from "./RaceVideo";
import { useFreeTiming } from "./freeTiming";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEvents } from "./store";
import {
  atTime,
  calendar,
  countdown,
  json,
  nextRace,
  openF1,
  stamp,
  weekend,
  type Datum,
  type Driver,
  type Race,
  type Session,
  type Track,
} from "./data";
import { RaceScene } from "./RaceScene";
import "./events.css";
const date = (s: string, utc = false) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(utc ? { timeZone: "UTC" } : {}),
  }).format(new Date(s));
const duration = (s: unknown): string => {
  if (Array.isArray(s)) return s.map(duration).join(" / ");
  if (typeof s !== "number" || !Number.isFinite(s)) return "—";
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, "0")}`;
};
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Provider unavailable";
export function Events() {
  const open = useEvents((s) => s.open);
  return open ? <EventWorkspace /> : null;
}
function EventWorkspace() {
  const details = useEvents((s) => s.details);
  const showDetails = (value: boolean) =>
    useEvents.setState({ details: value });
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear),
    [races, setRaces] = useState<Race[]>([]),
    [raceId, setRaceId] = useState(""),
    [filter, setFilter] = useState("upcoming"),
    [search, setSearch] = useState(""),
    [utc, setUtc] = useState(false),
    [now, setNow] = useState(Date.now()),
    [calendarState, setCalendarState] = useState("Loading calendar…"),
    [reload, setReload] = useState(0);
  const [tracks, setTracks] = useState<Record<string, Track>>({}),
    [sessions, setSessions] = useState<Session[]>([]),
    [sessionId, setSessionId] = useState<number | null>(null),
    [sessionState, setSessionState] = useState(""),
    [drivers, setDrivers] = useState<Driver[]>([]),
    [results, setResults] = useState<Datum[]>([]),
    [laps, setLaps] = useState<Datum[]>([]),
    [control, setControl] = useState<Datum[]>([]),
    [weather, setWeather] = useState<Datum[]>([]),
    [statsError, setStatsError] = useState("");
  const [selected, setSelected] = useState<number | null>(null),
    [follow, setFollow] = useState(false),
    [watching, setWatching] = useState(false),
    [live, setLive] = useState(false),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [time, setTime] = useState(0),
    [windowStart, setWindowStart] = useState(0),
    [locations, setLocations] = useState<Datum[]>([]),
    [telemetry, setTelemetry] = useState<Datum[]>([]),
    [positions, setPositions] = useState<Datum[]>([]),
    [intervals, setIntervals] = useState<Datum[]>([]),
    [stints, setStints] = useState<Datum[]>([]),
    [feedState, setFeedState] = useState(""),
    [loadedAt, setLoadedAt] = useState(0),
    [busy, setBusy] = useState(false);
  const playRef = useRef({ playing, speed, time });
  playRef.current = { playing: playing && !busy, speed, time };
  const session = sessions.find((s) => s.session_key === sessionId);
  const race = races.find((r) => r.round === raceId);
  const next = nextRace(races, now);
  const [timingRace, setTimingRace] = useState<Race | null>(null);
  const free = !!race && timingRace === race;
  const timing = useFreeTiming(race, free);
  const [freeDriver, setFreeDriver] = useState<number | null>(null);
  const [video, setVideo] = useState(false);
  const timingDriver =
    timing.cars.find((d) => d.driver_number === freeDriver) ?? timing.cars[0];

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const c = new AbortController();
    json(import.meta.env.BASE_URL + "events/circuits.json", c.signal)
      .then(setTracks)
      .catch(() => {});
    return () => c.abort();
  }, []);
  useEffect(() => {
    const c = new AbortController();
    setRaces([]);
    setCalendarState("Loading calendar…");
    calendar(year, c.signal)
      .then(({ races, snapshot }) => {
        if (c.signal.aborted) return;
        setRaces(races);
        setRaceId((nextRace(races, Date.now()) || races.at(-1))?.round || "");
        setCalendarState(
          snapshot
            ? "Saved calendar · Nov 20, 2026 · refresh unavailable"
            : "Calendar synced · Jolpica",
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) setCalendarState(message(e));
      });
    return () => c.abort();
  }, [year, reload]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") useEvents.getState().setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    setSessions([]);
    setBusy(false);
    setSessionId(null);
    setWatching(false);
    setPlaying(false);
    setLocations([]);
    setFollow(false);
    if (!race) return;
    const c = new AbortController();
    setSessionState("Discovering weekend sessions…");
    const start = new Date(
        Date.parse(stamp(race)) - 5 * 86400000,
      ).toISOString(),
      end = new Date(Date.parse(stamp(race)) + 86400000).toISOString();
    openF1<Session>(
      "sessions",
      { year, "date_start>": start, "date_start<": end },
      c.signal,
      300000,
    )
      .then((items) => {
        if (c.signal.aborted) return;
        const sorted = items.sort(
          (a, b) => Date.parse(a.date_start) - Date.parse(b.date_start),
        );
        setSessions(sorted);
        const chosen =
          sorted.find(
            (s) =>
              Date.parse(s.date_start) <= Date.now() &&
              Date.parse(s.date_end) > Date.now(),
          ) ||
          [...sorted]
            .reverse()
            .find((s) => Date.parse(s.date_start) < Date.now()) ||
          sorted[0];
        setSessionId(chosen?.session_key ?? null);
        setSessionState(
          items.length
            ? ""
            : "Session feeds have not been published yet. Weekend times are shown from the calendar.",
        );
      })
      .catch((e) => {
        if (!c.signal.aborted) setSessionState(message(e));
      });
    return () => c.abort();
  }, [race, year, reload]);
  useEffect(() => {
    setBusy(false);
    setDrivers([]);
    setResults([]);
    setLaps([]);
    setControl([]);
    setWeather([]);
    setStatsError("");
    setSelected(null);
    setWatching(false);
    setPlaying(false);
    setLocations([]);
    setTelemetry([]);
    setPositions([]);
    setIntervals([]);
    setStints([]);
    setFollow(false);
    setLoadedAt(0);
    if (!session) return;
    const c = new AbortController();
    const params = { session_key: session.session_key };
    const load = async () => {
      const errors: string[] = [];
      for (const [resource, setter] of [
        ["drivers", setDrivers],
        ["session_result", setResults],
        ["laps", setLaps],
        ["race_control", setControl],
        ["weather", setWeather],
      ] as const) {
        try {
          const items = await openF1<any>(resource, params, c.signal);
          if (c.signal.aborted) return;
          (setter as (x: any[]) => void)(items);
          if (resource === "drivers")
            setSelected(items[0]?.driver_number ?? null);
        } catch (e) {
          if (c.signal.aborted) return;
          errors.push(resource + ": " + message(e));
        }
      }
      setStatsError(errors.join(" · "));
    };
    void load();
    return () => c.abort();
  }, [session]);
  useEffect(() => {
    if (!watching || !session) return;
    const c = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      setBusy(!live || !playRef.current.playing);
      setFeedState(
        live ? "Connecting to live session…" : "Loading historical positions…",
      );
      const end = live
        ? Date.now()
        : Math.min(windowStart + 120000, Date.parse(session.date_end));
      const start = live ? end - 120000 : windowStart;
      if (end <= start) {
        setBusy(false);
        setFeedState("Session has not started");
        return;
      }
      const params = {
        session_key: session.session_key,
        "date>": new Date(start).toISOString(),
        "date<": new Date(end).toISOString(),
      };
      try {
        const loc = await openF1<Datum>(
          "location",
          params,
          c.signal,
          live ? 0 : 3600000,
        );
        if (c.signal.aborted) return;
        setLocations(loc);
        setLoadedAt(Date.now());
        if (!loc.length)
          setFeedState(
            "No position samples in this time window. Try another time.",
          );
        else
          setFeedState(
            live ? "LIVE · buffered feed" : "REPLAY · recorded telemetry",
          );
        if (live && loc.length) {
          setPlaying(true);
          setTime(
            Math.min(
              Date.now() - 18000,
              Math.max(...loc.map((p) => Date.parse(p.date))) - 1000,
            ),
          );
        } else if (!live) setTime(start + 1000);
        for (const [resource, setter] of [
          ["position", setPositions],
          ["intervals", setIntervals],
          ["stints", setStints],
        ] as const) {
          try {
            const rows = await openF1<Datum>(
              resource,
              { session_key: session.session_key },
              c.signal,
              live ? 20000 : 3600000,
            );
            if (!c.signal.aborted)
              setter(
                rows.sort(
                  (a, b) => Date.parse(a.date || "") - Date.parse(b.date || ""),
                ),
              );
          } catch {
            /* Missing timing channels never replace real positions with invented values. */
          }
        }
      } catch (e) {
        if (!c.signal.aborted) {
          setLocations([]);
          setFeedState(message(e));
          setPlaying(false);
        }
      } finally {
        if (!c.signal.aborted) {
          setBusy(false);
          if (live) timer = setTimeout(() => void load(), 20000);
        }
      }
    };
    void load();
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [watching, session, windowStart, live]);
  useEffect(() => {
    if (!watching || !session || !selected) return;
    const c = new AbortController();
    setTelemetry([]);
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const end = live
        ? Date.now()
        : Math.min(windowStart + 120000, Date.parse(session.date_end));
      const start = live ? end - 120000 : windowStart;
      if (end <= start) return;
      try {
        const rows = await openF1<Datum>(
          "car_data",
          {
            session_key: session.session_key,
            driver_number: selected,
            "date>": new Date(start).toISOString(),
            "date<": new Date(end).toISOString(),
          },
          c.signal,
          live ? 0 : 3600000,
        );
        if (!c.signal.aborted)
          setTelemetry(
            rows.sort((a, b) => Date.parse(a.date) - Date.parse(b.date)),
          );
      } catch {
        if (!c.signal.aborted) setTelemetry([]);
      }
      if (live && !c.signal.aborted)
        timer = setTimeout(() => void load(), 20000);
    };
    void load();
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [selected, watching, session, windowStart, live]);
  useEffect(() => {
    if (!live || !watching || !session) return;
    const c = new AbortController();
    const timer = setInterval(() => {
      for (const [resource, setter] of [
        ["laps", setLaps],
        ["race_control", setControl],
        ["weather", setWeather],
      ] as const)
        openF1<Datum>(
          resource,
          { session_key: session.session_key },
          c.signal,
          45000,
        )
          .then((rows) => {
            if (!c.signal.aborted) setter(rows);
          })
          .catch(() => {});
    }, 60000);
    return () => {
      c.abort();
      clearInterval(timer);
    };
  }, [live, watching, session]);
  useEffect(() => {
    let raf = 0,
      last = performance.now(),
      paint = last;
    const tick = (t: number) => {
      const p = playRef.current,
        dt = t - last;
      last = t;
      if (p.playing && watching) {
        const ceiling =
          live && locations.length
            ? Math.max(...locations.map((d) => Date.parse(d.date))) - 500
            : Infinity;
        const next = Math.min(p.time + dt * p.speed, ceiling);
        playRef.current.time = next;
        if (t - paint > 100) {
          paint = t;
          setTime(next);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [watching, live, locations]);
  useEffect(() => {
    if (!watching || !session || !playing || busy) return;
    const end = Date.parse(session.date_end);
    if (!live && time >= end) {
      setTime(end);
      setPlaying(false);
    } else if (!live && time >= windowStart + 118000) {
      setWindowStart(windowStart + 118000);
    }
    if (live && loadedAt && now - loadedAt > 45000) {
      setPlaying(false);
      setFeedState("STALE · live connection interrupted");
    }
  }, [
    time,
    watching,
    session,
    playing,
    busy,
    windowStart,
    live,
    loadedAt,
    now,
  ]);
  const rows = useMemo(
    () =>
      drivers
        .map((d) => {
          const p = atTime(positions, time, d.driver_number),
            result = results.find((r) => r.driver_number === d.driver_number),
            lap = [...laps]
              .reverse()
              .find(
                (l) =>
                  l.driver_number === d.driver_number &&
                  (!watching || Date.parse(l.date) <= time),
              ),
            gap = atTime(intervals, time, d.driver_number),
            tire = stints
              .filter(
                (s) =>
                  s.driver_number === d.driver_number &&
                  (s.lap_start ?? Infinity) <= (lap?.lap_number || 0),
              )
              .at(-1);
          return { d, p, result, lap, gap, tire };
        })
        .sort(
          (a, b) =>
            (watching ? (a.p?.position ?? 99) : (a.result?.position ?? 99)) -
            (watching ? (b.p?.position ?? 99) : (b.result?.position ?? 99)),
        ),
    [drivers, positions, results, laps, intervals, stints, time, watching],
  );
  const sampledCar = selected ? atTime(telemetry, time, selected) : undefined;
  const car =
    sampledCar && time - Date.parse(sampledCar.date) < 3000
      ? sampledCar
      : undefined;
  const chosenDriver = drivers.find((d) => d.driver_number === selected);
  const visible = races.filter(
    (r) =>
      (filter === "all" || Date.parse(stamp(r)) + 3 * 3600000 >= now) &&
      `${r.raceName} ${r.Circuit.Location.country} ${r.Circuit.Location.locality}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const startWatching = (isLive: boolean) => {
    if (!session) return;
    setTimingRace(null);
    setLive(isLive);
    setTime(isLive ? Date.now() - 18000 : Date.parse(session.date_start));
    setWindowStart(Date.parse(session.date_start));
    setPlaying(true);
    setWatching(true);
  };
  const activeSession =
    !!session &&
    Date.parse(session.date_start) <= now &&
    Date.parse(session.date_end) > now &&
    !session.is_cancelled;
  const currentWeather = weather
    .filter((w) => !watching || Date.parse(w.date) <= time)
    .at(-1);
  const nextSession = race
    ? weekend(race).find((s) => Date.parse(s.start) > now)
    : undefined;
  return (
    <>
      <div
        className={
          details ? "event-map-tools event-map-hidden" : "event-map-tools"
        }
      >
        {race && (
          <RaceScene
            key={
              race.Circuit.circuitId +
              "-" +
              (free ? "timing" : (sessionId ?? "preview"))
            }
            race={race}
            track={tracks[race.Circuit.circuitId]}
            drivers={drivers}
            locations={locations}
            time={time}
            selected={free ? (timingDriver?.driver_number ?? null) : selected}
            follow={follow}
            onSelect={free ? setFreeDriver : setSelected}
            watching={watching || free}
            timingCars={free ? timing.cars : undefined}
            races={races}
            onRace={setRaceId}
            onRelease={() => setFollow(false)}
          />
        )}
      </div>
      {!details && (
        <main className="event-earth-panel" aria-label="Live events">
          <header>
            <b>Formula 1</b>
            <button
              aria-label="Close events"
              onClick={() => useEvents.getState().setOpen(false)}
            >
              ×
            </button>
          </header>
          <label>
            Grand Prix
            <select value={raceId} onChange={(e) => setRaceId(e.target.value)}>
              {races.map((r) => (
                <option key={r.round} value={r.round}>
                  {r.raceName}
                </option>
              ))}
            </select>
          </label>
          {race && <p>{race.Circuit.circuitName}</p>}
          {sessions.length > 0 && !free && (
            <label>
              Weekend session
              <select
                value={sessionId ?? ""}
                onChange={(e) => setSessionId(+e.target.value)}
              >
                {sessions.map((s) => (
                  <option key={s.session_key} value={s.session_key}>
                    {s.session_name} · {date(s.date_start)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {race && (
            <button
              aria-pressed={free}
              onClick={() => {
                setTimingRace(free ? null : race);
                setWatching(false);
                setPlaying(false);
                setFollow(false);
              }}
            >
              {free ? "Stop free live tracking" : "Watch free live timing"}
            </button>
          )}
          {free && (
            <>
              <p role="status">
                {timing.session} {timing.status}
              </p>
              <p>
                Positions are estimated between sector updates. Cars appear
                after their first fresh sector crossing.
              </p>
              {timingDriver && (
                <>
                  <label>
                    Live driver
                    <select
                      value={timingDriver.driver_number}
                      onChange={(e) => setFreeDriver(+e.target.value)}
                    >
                      {timing.cars.map((d) => (
                        <option key={d.driver_number} value={d.driver_number}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    P{timingDriver.rank ?? "—"} · Lap time{" "}
                    {timingDriver.lap ?? "—"}
                  </p>
                  <button onClick={() => setFollow(!follow)}>
                    {follow ? "Release camera" : "Follow car"}
                  </button>
                </>
              )}
            </>
          )}
          <button aria-expanded={video} onClick={() => setVideo(!video)}>
            {video ? "Hide video" : "Video on Earth"}
          </button>
          {session &&
            Date.parse(session.date_start) <= now &&
            !session.is_cancelled &&
            !free &&
            !watching && (
              <button
                className="event-watch"
                onClick={() => startWatching(activeSession)}
              >
                {activeSession ? "Watch live on Earth" : "Replay on Earth"}
              </button>
            )}
          {!free && (
            <p role="status">
              {watching
                ? feedState
                : sessionState ||
                  (nextSession
                    ? "Next: " +
                      nextSession.name +
                      " in " +
                      countdown(nextSession.start, now)
                    : calendarState)}
            </p>
          )}
          {watching && (
            <>
              <label>
                Driver
                <select
                  value={selected ?? ""}
                  onChange={(e) => setSelected(+e.target.value)}
                >
                  {drivers.map((d) => (
                    <option key={d.driver_number} value={d.driver_number}>
                      {d.name_acronym} · {d.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="event-instruments">
                <div>
                  <strong>{car?.speed ?? "—"}</strong> km/h
                </div>
                <div>
                  Gear <strong>{car?.n_gear ?? "—"}</strong>
                </div>
              </div>
              <p>
                Throttle {car?.throttle ?? "—"}% · Brake{" "}
                {car?.brake == null ? "—" : car.brake ? "on" : "off"}
              </p>
              <div className="event-driving">
                <button
                  disabled={!locations.length || !selected}
                  aria-pressed={follow}
                  onClick={() => setFollow(!follow)}
                >
                  {follow ? "Release camera" : "Follow car"}
                </button>
                {!live && (
                  <button disabled={busy} onClick={() => setPlaying(!playing)}>
                    {playing ? "Pause" : "Play"}
                  </button>
                )}
              </div>
            </>
          )}
          <button onClick={() => showDetails(true)}>
            Weekend details, stats &amp; replays ↗
          </button>
        </main>
      )}
      {!details && video && (
        <RaceVideo
          vegas={race?.Circuit.circuitId === "vegas" && race.season === "2026"}
          onClose={() => setVideo(false)}
        />
      )}
      {details && (
        <main className="events-workspace" aria-label="Live events">
          <header className="events-top">
            <div className="events-brand">
              <b>
                AURORA<span> / EVENTS</span>
              </b>
              <small>EARTH IS THE ARENA.</small>
            </div>
            <div className="events-top-right">
              <button onClick={() => showDetails(false)}>
                Track on Earth ↗
              </button>
              <span className="events-dot" />
              FORMULA 1 <span className="events-season">{year} SEASON</span>
              <button
                onClick={() => useEvents.getState().setOpen(false)}
                aria-label="Close events"
              >
                Close events
              </button>
            </div>
          </header>
          <div className="events-layout">
            <aside className="events-calendar">
              <div className="events-section-label">
                THE WORLD TOUR <span>01 / F1</span>
              </div>
              <h1>
                Race
                <br />
                <em>weekends.</em>
              </h1>
              <div
                className="events-year"
                role="group"
                aria-label="Calendar season"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <button
                    key={y}
                    aria-pressed={year === y}
                    onClick={() => {
                      setYear(y);
                      setFilter(y < currentYear ? "all" : "upcoming");
                    }}
                  >
                    {y}
                    {y === currentYear + 1 ? " ↗" : ""}
                  </button>
                ))}
              </div>
              <div className="events-filters">
                <button
                  aria-pressed={filter === "upcoming"}
                  onClick={() => setFilter("upcoming")}
                >
                  Upcoming
                </button>
                <button
                  aria-pressed={filter === "all"}
                  onClick={() => setFilter("all")}
                >
                  Full season
                </button>
              </div>
              <input
                className="events-search"
                aria-label="Search race events"
                placeholder="Find a race or country…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="events-race-list">
                {visible.map((r) => (
                  <button
                    key={r.round}
                    className={
                      "events-race " + (r.round === raceId ? "selected" : "")
                    }
                    onClick={() => setRaceId(r.round)}
                  >
                    <span className="events-round">
                      {r.round.padStart(2, "0")}
                    </span>
                    <span>
                      <strong>{r.Circuit.Location.locality}</strong>
                      <small>{r.raceName}</small>
                      <time>
                        {new Date(stamp(r)).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: utc ? "UTC" : undefined,
                        })}{" "}
                        · {r.Circuit.Location.country}
                      </time>
                    </span>
                    <span className="events-arrow">↗</span>
                  </button>
                ))}
                {!visible.length && (
                  <div className="events-empty">
                    <b>
                      {races.length
                        ? "No matching races"
                        : calendarState.includes("Loading")
                          ? "Loading season…"
                          : "Calendar not published"}
                    </b>
                    <p>
                      {races.length
                        ? "Try Full season or another search."
                        : `${year} events will appear here when the provider publishes the schedule.`}
                    </p>
                    <button onClick={() => setReload((n) => n + 1)}>
                      Refresh calendar
                    </button>
                  </div>
                )}
              </div>
              <footer className="events-source">
                {calendarState}
                <button
                  onClick={() => setReload((n) => n + 1)}
                  aria-label="Refresh events"
                >
                  ↻
                </button>
              </footer>
            </aside>
            <section className="events-main">
              {race ? (
                <>
                  <div className="events-hero">
                    <div>
                      <div className="events-section-label">
                        ROUND {race.round.padStart(2, "0")}{" "}
                        <span>
                          {" "}
                          / {race.Circuit.Location.country.toUpperCase()}
                        </span>
                      </div>
                      <h2>
                        {race.Circuit.Location.locality}
                        <span>Grand Prix</span>
                      </h2>
                      <p>{race.Circuit.circuitName}</p>
                    </div>
                    <div className="events-countdown">
                      <span>
                        {next ? "NEXT GRAND PRIX" : "SEASON COMPLETE"}
                      </span>
                      <strong>
                        {next
                          ? next.time
                            ? countdown(stamp(next), now)
                            : "START TIME TBC"
                          : "SEE YOU NEXT SEASON"}
                      </strong>
                      <small>
                        {next
                          ? next.raceName
                          : "Explore the full season or switch calendar year"}
                      </small>
                    </div>
                  </div>
                  <div className="events-weekend-heading">
                    <h3>The whole weekend.</h3>
                    <button aria-pressed={utc} onClick={() => setUtc(!utc)}>
                      {utc ? "UTC" : "Your local time"} ⇄
                    </button>
                  </div>
                  <div className="events-weekend">
                    {weekend(race).map((s, i) => {
                      const matching = sessions.find(
                        (x) =>
                          x.session_name === s.name ||
                          (s.name === "Sprint Qualifying" &&
                            x.session_name === "Sprint Shootout"),
                      );
                      const past = Date.parse(s.start) < now;
                      const active =
                        matching &&
                        Date.parse(matching.date_start) <= now &&
                        Date.parse(matching.date_end) > now;
                      return (
                        <button
                          key={s.name}
                          className={
                            sessionId && matching?.session_key === sessionId
                              ? "chosen"
                              : ""
                          }
                          onClick={() =>
                            matching && setSessionId(matching.session_key)
                          }
                          disabled={!matching}
                        >
                          <span className="events-session-index">
                            0{i + 1}{" "}
                            <b>
                              {matching?.is_cancelled
                                ? "CANCELLED"
                                : active
                                  ? "IN SESSION"
                                  : past
                                    ? "COMPLETED"
                                    : "UP NEXT"}
                            </b>
                          </span>
                          <strong>{s.name}</strong>
                          <time>
                            {s.confirmed
                              ? date(s.start, utc)
                              : "Time to be confirmed"}
                          </time>
                          {!past && s.confirmed && (
                            <small>in {countdown(s.start, now)}</small>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {nextSession && (
                    <p className="events-next-session">
                      NEXT SESSION <b>{nextSession.name}</b>{" "}
                      <span>{countdown(nextSession.start, now)}</span>
                    </p>
                  )}
                  <div className="events-stage-head">
                    <div>
                      <span className="events-section-label">
                        RACE CONTROL /{" "}
                        {session?.session_name.toUpperCase() ||
                          "WEEKEND PREVIEW"}
                      </span>
                      <h3>
                        {watching
                          ? "On the circuit."
                          : "Get closer to the action."}
                      </h3>
                    </div>
                    <div>
                      {session &&
                        Date.parse(session.date_start) < now &&
                        !session.is_cancelled && (
                          <button
                            className="events-primary"
                            disabled={busy}
                            onClick={() => startWatching(activeSession)}
                          >
                            {activeSession
                              ? "Watch live ↗"
                              : "Watch real replay ↗"}
                          </button>
                        )}
                      <button
                        onClick={() => {
                          setFollow(false);
                          setWatching(false);
                          setPlaying(false);
                        }}
                      >
                        Circuit overview
                      </button>
                    </div>
                  </div>
                  {sessionState && (
                    <p className="events-notice" role="status">
                      {sessionState}
                    </p>
                  )}
                  <div className="events-map-link">
                    <button onClick={() => showDetails(false)}>
                      View circuit on Earth ↗
                    </button>
                    {watching && (
                      <span className="events-track-badge-inline" role="status">
                        {feedState}
                      </span>
                    )}
                  </div>
                  {watching && session && (
                    <div className="events-playback">
                      <button
                        disabled={busy || !locations.length}
                        onClick={() => setPlaying(!playing)}
                        aria-label={playing ? "Pause replay" : "Play replay"}
                      >
                        {playing ? "Ⅱ" : "▶"}
                      </button>
                      <span>
                        {new Date(time).toISOString().slice(11, 19)} UTC
                      </span>
                      <input
                        aria-label="Session replay time"
                        type="range"
                        min={Date.parse(session.date_start)}
                        max={Math.max(
                          Date.parse(session.date_start) + 1,
                          Math.min(now, Date.parse(session.date_end)),
                        )}
                        step={1000}
                        disabled={live}
                        value={time}
                        onChange={(e) => {
                          setPlaying(false);
                          setTime(+e.target.value);
                        }}
                        onPointerUp={(e) =>
                          setWindowStart(
                            Math.min(
                              +(e.target as HTMLInputElement).value,
                              Date.parse(session.date_end) - 2000,
                            ),
                          )
                        }
                        onKeyUp={(e) =>
                          setWindowStart(
                            Math.min(
                              +(e.target as HTMLInputElement).value,
                              Date.parse(session.date_end) - 2000,
                            ),
                          )
                        }
                      />
                      <select
                        aria-label="Replay speed"
                        value={speed}
                        onChange={(e) => setSpeed(+e.target.value)}
                      >
                        {[0.5, 1, 2, 4, 8].map((s) => (
                          <option key={s} value={s}>
                            {s}×
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!selected || !locations.length}
                        aria-pressed={follow}
                        onClick={() => setFollow(!follow)}
                      >
                        {follow ? "Following" : "Follow driver"}
                      </button>
                      {activeSession && !live && (
                        <button onClick={() => startWatching(true)}>
                          Go live
                        </button>
                      )}
                    </div>
                  )}
                  <div className="events-data-grid">
                    <section className="events-timing">
                      <div className="events-section-label">
                        {watching ? "RUNNING ORDER" : "SESSION RESULTS"}
                        <span>
                          {session?.session_name || "Awaiting session"}
                        </span>
                      </div>
                      {!drivers.length ? (
                        <div className="events-empty">
                          {session
                            ? "Loading entrants and timing…"
                            : "Session entries will appear when published."}
                        </div>
                      ) : (
                        <div className="events-table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>POS</th>
                                <th>DRIVER / TEAM</th>
                                <th>
                                  {watching ? "GAP" : "TIME / Q1 · Q2 · Q3"}
                                </th>
                                <th>LAPS</th>
                                <th>TYRE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(({ d, p, result, lap, gap, tire }) => (
                                <tr
                                  key={d.driver_number}
                                  className={
                                    selected === d.driver_number
                                      ? "selected"
                                      : ""
                                  }
                                >
                                  <td>
                                    {(watching
                                      ? p?.position
                                      : result?.position) || "—"}
                                  </td>
                                  <td>
                                    <button
                                      onClick={() =>
                                        setSelected(d.driver_number)
                                      }
                                    >
                                      <i
                                        style={{
                                          background: "#" + d.team_colour,
                                        }}
                                      />
                                      <span>
                                        <b>
                                          {d.name_acronym}{" "}
                                          <small>#{d.driver_number}</small>
                                        </b>
                                        <small>{d.team_name}</small>
                                      </span>
                                    </button>
                                  </td>
                                  <td>
                                    {watching
                                      ? gap?.gap_to_leader != null
                                        ? `${gap.gap_to_leader === 0 ? "LEADER" : "+" + gap.gap_to_leader}`
                                        : "—"
                                      : result?.dsq
                                        ? "DSQ"
                                        : result?.dns
                                          ? "DNS"
                                          : result?.dnf
                                            ? "DNF"
                                            : duration(result?.duration)}
                                  </td>
                                  <td>
                                    {watching
                                      ? (lap?.lap_number ?? "—")
                                      : (result?.number_of_laps ?? "—")}
                                  </td>
                                  <td>
                                    <span
                                      className={
                                        "events-tyre " +
                                        (tire?.compound || "").toLowerCase()
                                      }
                                    >
                                      {tire?.compound?.slice(0, 1) || "—"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                    <section className="events-telemetry">
                      <div className="events-section-label">
                        DRIVER TELEMETRY{" "}
                        <span>
                          {chosenDriver?.name_acronym || "SELECT DRIVER"}
                        </span>
                      </div>
                      <h3>
                        {chosenDriver?.full_name || "The human. The machine."}
                      </h3>
                      <div className="events-speed">
                        <b>{car?.speed ?? "—"}</b>
                        <span>KM/H</span>
                        <strong>
                          {car?.n_gear ?? "—"}
                          <small>GEAR</small>
                        </strong>
                      </div>
                      <div className="events-trace">
                        <span>
                          THROTTLE{" "}
                          <b>
                            {car?.throttle != null ? car.throttle + "%" : "—"}
                          </b>
                        </span>
                        <div>
                          <i style={{ width: (car?.throttle || 0) + "%" }} />
                        </div>
                      </div>
                      <div className="events-trace brake">
                        <span>
                          BRAKE{" "}
                          <b>
                            {car?.brake != null
                              ? car.brake
                                ? "ON"
                                : "OFF"
                              : "—"}
                          </b>
                        </span>
                        <div>
                          <i style={{ width: car?.brake ? "100%" : "0%" }} />
                        </div>
                      </div>
                      <p className="events-rpm">
                        {car?.rpm?.toLocaleString() ?? "—"} RPM
                      </p>
                      <p className="events-fine">
                        {watching
                          ? "Values follow the selected driver at the playback timestamp. Position samples are approximate; lateral placement is not supplied."
                          : "Start a replay or live session to see synchronized telemetry. No simulated telemetry is displayed."}
                      </p>
                      <div className="events-weather">
                        <span>
                          AIR <b>{currentWeather?.air_temperature ?? "—"}°</b>
                        </span>
                        <span>
                          TRACK{" "}
                          <b>{currentWeather?.track_temperature ?? "—"}°</b>
                        </span>
                        <span>
                          RAIN{" "}
                          <b>
                            {currentWeather?.rainfall == null
                              ? "—"
                              : currentWeather.rainfall
                                ? "YES"
                                : "NO"}
                          </b>
                        </span>
                      </div>
                    </section>
                  </div>
                  <section className="events-race-control">
                    <div className="events-section-label">
                      RACE CONTROL{" "}
                      <span>FLAGS / INCIDENTS / SESSION UPDATES</span>
                    </div>
                    {control
                      .filter((x) => !watching || Date.parse(x.date) <= time)
                      .slice(-5)
                      .reverse()
                      .map((c, i) => (
                        <p key={i}>
                          <time>
                            {new Date(c.date).toISOString().slice(11, 19)}
                          </time>
                          {c.message}
                        </p>
                      ))}
                    {!control.length && (
                      <p>
                        No published race-control messages for this session.
                      </p>
                    )}
                  </section>
                  {statsError && (
                    <p className="events-notice" role="status">
                      Some session data is unavailable. {statsError}
                    </p>
                  )}
                  <footer className="events-credits">
                    Calendar & results: Jolpica / OpenF1 · Circuit geometry:
                    bacinger/f1-circuits (MIT) · Original 3D car model ·
                    Independent fan visualization. Live OpenF1 access requires a
                    subscription and gateway configuration.{" "}
                    <a
                      href="https://openf1.org/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Data access ↗
                    </a>
                  </footer>
                </>
              ) : (
                <div className="events-season-empty">
                  <span className="events-section-label">THE NEXT CHAPTER</span>
                  <h2>
                    {year}
                    <br />
                    <em>Stay on the grid.</em>
                  </h2>
                  <p>
                    {calendarState.includes("Loading")
                      ? "Loading the season calendar…"
                      : `No published events are available for ${year} yet. Dates and weekend sessions will appear here as the calendar becomes available.`}
                  </p>
                  <button onClick={() => setReload((n) => n + 1)}>
                    Check for events ↻
                  </button>
                </div>
              )}
            </section>
          </div>
        </main>
      )}
    </>
  );
}
