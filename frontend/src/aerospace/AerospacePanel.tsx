import { AircraftRoute } from "./AircraftRoute";
import { ASCENT_DURATION, ascentSample } from "./liftoff";
import { useEffect, useState } from "react";
import { env } from "../utils/env";
import { useAerospace } from "./store";
import { countdown, parseAircraft, parseWorldwideAircraft, parseLaunches } from "./data";
import { useAuroraStore } from "../store/auroraStore";
import "./aerospace.css";
function endpoint(path: string): string | null {
  if (!env.VITE_WS_URL) return null;
  try {
    const u = new URL(env.VITE_WS_URL);
    u.protocol = u.protocol === "wss:" ? "https:" : "http:";
    u.pathname = "/api/aerospace/" + path;
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}
function useFeed(
  kind: "aircraft" | "launches",
  region: string,
  enabled: boolean,
) {
  const [info, setInfo] = useState({ at: "", error: "", stale: false });
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    useAerospace
      .getState()
      .set(kind === "aircraft" ? { aircraft: [] } : { launches: [] });
    setInfo({ at: "", error: "", stale: false });
    if (!enabled) return;
    const url = endpoint(
      kind === "aircraft" ? `aircraft/${region}` : "launches",
    );
    if (!url) {
      setInfo({
        at: "",
        error:
          "Live feeds require npm start and a configured gateway. Mission Lab remains available offline.",
        stale: false,
      });
      return;
    }
    const poll = async () => {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            typeof body?.error === "string"
              ? body.error
              : `Feed unavailable (${response.status})`,
          );
        if (!Number.isFinite(Date.parse(body.fetchedAt)))
          throw new Error("Invalid feed timestamp");
        const values =
          kind === "aircraft"
            ? { aircraft: region === "worldwide" ? parseWorldwideAircraft(body.data) : parseAircraft(body.data) }
            : { launches: parseLaunches(body.data) };
        if (!stopped) {
          useAerospace.getState().set(values);
          setInfo({
            at: body.fetchedAt,
            error:
              body.stale === true && typeof body.error === "string"
                ? body.error
                : "",
            stale: body.stale === true,
          });
        }
      } catch (e) {
        if (!stopped)
          setInfo((old) => ({
            ...old,
            error: e instanceof Error ? e.message : "Feed unavailable",
            stale: true,
          }));
      } finally {
        if (!stopped)
          timer = setTimeout(poll, kind === "aircraft" ? (region === "worldwide" ? 60000 : 10000) : 300000);
      }
    };
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [kind, region, enabled]);
  useEffect(() => {
    const state = useAerospace.getState();
    state.set({ feedInfo: { ...state.feedInfo, [kind]: info } });
  }, [info, kind]);
  return info;
}
export function AerospacePanel() {
  const s = useAerospace();
  const tab = s.tab;
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const mode = useAuroraStore((x) => x.currentMode);
  const air = useFeed("aircraft", s.region, s.aircraftOn);
  const launches = useFeed("launches", "", s.launchesOn);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const aircraft = s.aircraft.filter(
    (a) =>
      (!s.militaryOnly || a.military) &&
      now - a.observedAt < 90000 &&
      `${a.name} ${a.model} ${a.registration}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selectedAir = s.aircraft.find((a) => "air:" + a.id === s.selected);
  const selectedLaunch = s.launches.find(
    (l) => "launch:" + l.id === s.selected,
  );
  const followedLaunch = s.launches.find((l) => l.id === s.followedLaunchId);
  const info = tab === "launches" ? launches : air;
  const age = info.at
    ? Math.max(0, Math.floor((now - Date.parse(info.at)) / 1000))
    : null;
  if (mode === "HELIO") return null;
  return (
    <div className="aerospace">
      {s.simulation && (
        <div className="liftoff-banner" role="status">
          <strong>SIMULATED PREVIEW · NOT LIVE</strong>
          <span>
            {s.simulation.terrainReady
              ? `T+ ${s.simulation.seconds.toFixed(1)}s · ${(ascentSample(s.simulation.seconds).altitude / 1000).toFixed(1)} km above pad`
              : "Preparing launch terrain…"}
          </span>
          <button onClick={() => s.set({ simulation: null })}>
            Exit preview
          </button>
        </div>
      )}
      {s.followedLaunchId && (
        <aside className="launch-watch" aria-label="Following launch">
          <small>
            {s.rocketTelemetry.status === "live"
              ? "OBSERVED ROCKET POSITIONS"
              : "MISSION WATCH · STATUS FEED"}
          </small>
          <strong>{followedLaunch?.name || "Waiting for mission data"}</strong>
          <span>
            {followedLaunch
              ? countdown(followedLaunch.net, now, followedLaunch.status)
              : "Mission absent from latest feed"}
          </span>
          <p>
            {launches.stale || launches.error
              ? "Launch status may be outdated. "
              : ""}
            {s.rocketTelemetry.status === "live"
              ? "Observed rocket position stream connected."
              : s.rocketTelemetry.status === "waiting"
                ? "Waiting for observed rocket positions."
                : s.rocketTelemetry.error ||
                  "No live rocket positions connected."}{" "}
            The countdown alone will not start an animation.
          </p>
          {!!s.rocketTelemetry.positions.length && (
            <div className="rocket-vehicle-choices">
              {s.rocketTelemetry.positions.map((p) => (
                <button
                  key={p.vehicleId}
                  aria-pressed={s.telemetryVehicle === p.vehicleId}
                  onClick={() => s.set({ telemetryVehicle: p.vehicleId })}
                >
                  {p.vehicleId} · {p.phase} ·{" "}
                  {Math.round(p.altitudeM).toLocaleString()} m ·{" "}
                  {Math.max(0, Math.floor((now - p.observedAt) / 1000))}s ago
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              s.set({
                selected: "launch:" + s.followedLaunchId,
                open: true,
                tab: "launches",
                launchCameraFollow: true,
              });
            }}
          >
            Show watched launch
          </button>
          <button
            onClick={() =>
              s.set({ followedLaunchId: null, launchCameraFollow: false })
            }
          >
            Stop following launch
          </button>
        </aside>
      )}
      {s.open && (
        <section
          className="aerospace-panel"
          aria-label="Air and launch workspace"
        >
          <header>
            <div>
              <small>AURORA · AIR TO ORBIT</small>
              <h2>{tab === "launches" ? "Rockets & launches" : "Aircraft"}</h2>
            </div>
            <button
              aria-label="Close aerospace workspace"
              onClick={() => s.set({ open: false })}
            >
              ×
            </button>
          </header>
          <p className="aerospace-status" role="status">
            {!(tab === "launches" ? s.launchesOn : s.aircraftOn)
              ? "Layer disabled"
              : info.error ||
                (age === null
                  ? "Waiting for feed…"
                  : `${info.stale ? "STALE · " : ""}Fetched ${age}s ago`)}{" "}
            {tab === "launches"
              ? "· Refreshes every 5 min"
              : s.region === "worldwide" ? "· OpenSky · Refreshes every minute" : "· Refreshes every 10 sec"}
          </p>
          {!(tab === "aircraft" ? s.aircraftOn : s.launchesOn) && (
            <button
              onClick={() =>
                s.set(
                  tab === "aircraft"
                    ? { aircraftOn: true }
                    : { launchesOn: true },
                )
              }
            >
              Show {tab === "aircraft" ? "aircraft" : "rockets"} layer
            </button>
          )}
          {tab === "aircraft" && (
            <>
              <label className="aerospace-field">
                Coverage region
                <select
                  value={s.region}
                  onChange={(e) =>
                    s.set({ region: e.target.value, selected: null, militaryOnly: false })
                  }
                >
                  <option value="worldwide">Worldwide · OpenSky network</option>
                  {s.region.startsWith("point/") && (
                    <option value={s.region}>Current map area</option>
                  )}
                  <option value="florida">Florida / Cape Canaveral</option>
                  <option value="california">California / Vandenberg</option>
                  <option value="chicago">Chicago</option>
                  <option value="europe">Central Europe</option>
                  <option value="asia">Japan</option>
                  <option value="australia">Australia / Sydney</option>
                  <option value="india">India / Delhi</option>
                  <option value="brazil">Brazil / São Paulo</option>
                  <option value="africa">South Africa / Johannesburg</option>
                  <option value="gulf">UAE / Dubai</option>
                  <option value="military">
                    Worldwide public military feed
                  </option>
                </select>
              </label>
              <button onClick={() => s.set({ scanId: s.scanId + 1 })}>
                Scan area beneath camera
              </button>
              <label className="aerospace-field">
                Find aircraft
                <input
                  placeholder="Callsign, registration or type"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={s.militaryOnly}
                  disabled={s.region === "worldwide"}
                  onChange={(e) => s.set({ militaryOnly: e.target.checked })}
                />{" "}
                Military-tagged only
              </label>
              <p className="aerospace-note">
                {s.region === "worldwide"
                  ? "Worldwide OpenSky receiver coverage, updated every minute. Public access has a daily quota; updates pause when the provider limit is reached. Aircraft type and military classification are not supplied. "
                  : "Pan anywhere on Earth, then scan that area (250 nautical miles). "}
                Only received public broadcasts appear; coverage gaps remain over oceans and areas without receivers. Positions older than 90
                seconds are hidden. Cyan: civilian / unclassified. Amber:
                military-tagged. Motion is estimated from reported speed and
                heading for up to 30 seconds; then markers freeze gray. Selected
                trails join observations recorded during this session. Military
                coverage is limited to public broadcasts; missile tracking is
                unavailable.
              </p>
            </>
          )}
          {tab === "aircraft" && selectedAir && (
            <article className="aerospace-detail">
              <small>AIRCRAFT · OBSERVATION + ESTIMATED MOTION</small>
              <AircraftRoute aircraft={selectedAir} />
              <h3>{selectedAir.name}</h3>
              <p>
                {selectedAir.model} ·{" "}
                {selectedAir.registration || selectedAir.id}
              </p>
              <p>
                {Math.round(selectedAir.altitudeM).toLocaleString()} m (
                {selectedAir.altitudeKind}) · {selectedAir.speed ?? "—"} kt ·{" "}
                {selectedAir.heading ?? "—"}°
              </p>
              <p>
                Position age:{" "}
                {Math.max(0, Math.round((now - selectedAir.observedAt) / 1000))}
                s
              </p>
              <p className="aerospace-note">
                Representative aircraft model; dimensions and attitude are
                illustrative. Position and heading follow the public feed with
                bounded motion estimation.
              </p>
              <div className="aerospace-options">
                <button
                  aria-pressed={s.aircraftFollow}
                  onClick={() =>
                    s.set({
                      aircraftFollow: !s.aircraftFollow,
                      launchCameraFollow: false,
                    })
                  }
                >
                  {s.aircraftFollow ? "Following aircraft" : "Follow aircraft"}
                </button>
                <button
                  onClick={() =>
                    s.set({ selected: null, aircraftFollow: false })
                  }
                >
                  Clear aircraft selection
                </button>
              </div>
              <button onClick={() => s.focus("air:" + selectedAir.id)}>
                Locate on globe ↗
              </button>
            </article>
          )}
          {tab === "launches" && selectedLaunch && (
            <article className="aerospace-detail">
              <small>LAUNCH WATCH · {selectedLaunch.status}</small>
              <h3>{selectedLaunch.name}</h3>
              <strong className="launch-countdown">
                {countdown(selectedLaunch.net, now, selectedLaunch.status)}
              </strong>
              <p>
                {selectedLaunch.rocket} · {selectedLaunch.provider}
              </p>
              <p>{selectedLaunch.pad}</p>
              <p>
                Scheduled:{" "}
                {selectedLaunch.net
                  ? new Date(selectedLaunch.net).toUTCString()
                  : "Unconfirmed"}{" "}
                · Precision: {selectedLaunch.precision}
              </p>
              <p>
                Window: {selectedLaunch.windowStart || "Unconfirmed"} →{" "}
                {selectedLaunch.windowEnd || "Unconfirmed"}
              </p>
              <p>{selectedLaunch.description}</p>
              {!selectedLaunch.webcast && (
                <p className="aerospace-note" role="status">
                  No webcast link is published in the launch feed yet. This
                  page checks for updates every five minutes. Live ascent and
                  descent measurements require a connected telemetry source.
                </p>
              )}
              <div className="aerospace-options">
                <button
                  disabled={
                    selectedLaunch.lat === null || selectedLaunch.lon === null
                  }
                  onClick={() => s.focus("launch:" + selectedLaunch.id)}
                >
                  Locate launch site ↗
                </button>
                {selectedLaunch.webcast && (
                  <a
                    href={selectedLaunch.webcast}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Watch webcast ↗
                  </a>
                )}
              </div>
              <button
                aria-pressed={s.followedLaunchId === selectedLaunch.id}
                disabled={
                  selectedLaunch.lat === null || selectedLaunch.lon === null
                }
                onClick={() => {
                  const stop = s.followedLaunchId === selectedLaunch.id;
                  s.set({
                    followedLaunchId: stop ? null : selectedLaunch.id,
                    launchCameraFollow: !stop,
                    simulation: null,
                    aircraftFollow: false,
                    launchesOn: true,
                  });
                }}
              >
                {s.followedLaunchId === selectedLaunch.id
                  ? "Following launch · stop"
                  : "Follow launch"}
              </button>
              <p className="aerospace-note">
                One mission at a time. Watches the site and provider status
                while this page is open. Observed ascent/descent requires a
                connected position provider.
              </p>
              <dl>
                <div>
                  <dt>Departure site</dt>
                  <dd>{selectedLaunch.pad}</dd>
                </div>
                <div>
                  <dt>Landing / recovery</dt>
                  <dd>Not supplied by this feed</dd>
                </div>
              </dl>
              <div className="liftoff-controls">
                <button
                  disabled={
                    selectedLaunch.lat === null || selectedLaunch.lon === null
                  }
                  onClick={() =>
                    s.set({
                      simulation: {
                        launchId: selectedLaunch.id,
                        seconds: 0,
                        playing: true,
                        rate: 1,
                        follow: true,
                        terrainReady: false,
                      },
                      followedLaunchId: null,
                      launchesOn: true,
                    })
                  }
                >
                  ▶ Preview simulated liftoff
                </button>
                {s.simulation?.launchId === selectedLaunch.id && (
                  <>
                    <div className="aerospace-options">
                      <button
                        onClick={() =>
                          s.set({
                            simulation: {
                              ...s.simulation!,
                              playing: !s.simulation!.playing,
                            },
                          })
                        }
                      >
                        {s.simulation.playing ? "Pause ascent" : "Play ascent"}
                      </button>
                      <button
                        onClick={() =>
                          s.set({
                            simulation: {
                              ...s.simulation!,
                              seconds: 0,
                              playing: true,
                            },
                          })
                        }
                      >
                        Restart ascent
                      </button>
                      <button
                        aria-pressed={s.simulation.follow}
                        onClick={() =>
                          s.set({
                            simulation: {
                              ...s.simulation!,
                              follow: !s.simulation!.follow,
                            },
                          })
                        }
                      >
                        {s.simulation.follow
                          ? "Following rocket"
                          : "Follow rocket"}
                      </button>
                    </div>
                    <label className="aerospace-field">
                      Simulation time
                      <input
                        aria-label="Simulation time"
                        type="range"
                        min="0"
                        max={ASCENT_DURATION}
                        step="0.1"
                        value={s.simulation.seconds}
                        onChange={(e) =>
                          s.set({
                            simulation: {
                              ...s.simulation!,
                              seconds: Number(e.target.value),
                              playing: false,
                            },
                          })
                        }
                      />
                    </label>
                    <label className="aerospace-field">
                      Simulation speed
                      <select
                        value={s.simulation.rate}
                        onChange={(e) =>
                          s.set({
                            simulation: {
                              ...s.simulation!,
                              rate: Number(e.target.value),
                            },
                          })
                        }
                      >
                        <option value="1">1×</option>
                        <option value="5">5×</option>
                        <option value="10">10×</option>
                      </select>
                    </label>
                    <p className="aerospace-note">
                      Generic rocket and illustrative eastward ascent. Not the
                      actual vehicle geometry, flight plan, or live telemetry.
                      This preview does not change the mission countdown.
                    </p>
                  </>
                )}
              </div>
              <p className="aerospace-note">
                Rocket symbol marks the launch site, not an airborne vehicle.
                Launch Library 2 supplies schedules. Live rocket positions
                require a separate connected telemetry source.
              </p>
            </article>
          )}
          <div className="aerospace-list">
            {tab === "launches"
              ? s.launches.map((l) => (
                  <button
                    className="aerospace-row"
                    key={l.id}
                    aria-pressed={s.selected === "launch:" + l.id}
                    onClick={() => {
                      s.set({ selected: "launch:" + l.id, simulation: null });
                    }}
                  >
                    <span>
                      {l.status} · {l.precision} precision
                    </span>
                    <strong>{l.name}</strong>
                    <b>{countdown(l.net, now, l.status)}</b>
                    <span>{l.pad}</span>
                  </button>
                ))
              : aircraft.slice(0, 150).map((a) => (
                  <button
                    className="aerospace-row"
                    key={a.id}
                    aria-pressed={s.selected === "air:" + a.id}
                    onClick={() => s.set({ selected: "air:" + a.id })}
                  >
                    <strong>
                      {a.name} {a.military ? "· MIL" : ""}
                    </strong>
                    <span>
                      {a.model} · {Math.round(a.altitudeM)} m · {a.speed ?? "—"}{" "}
                      kt
                    </span>
                  </button>
                ))}
          </div>
          {tab === "aircraft" && (
            <p className="aerospace-note">
              {aircraft.length} recent aircraft · list shows first 150; globe
              shows all eligible results.
            </p>
          )}
          {!info.error &&
            info.at &&
            ((tab === "launches" && s.launches.length === 0) ||
              (tab === "aircraft" && aircraft.length === 0)) && (
              <p>No matching observations in this feed.</p>
            )}
          <footer>
            Sources:{" "}
            <a href="https://openskynetwork.github.io/opensky-api/rest.html" target="_blank" rel="noreferrer">OpenSky Network</a>{" / "}
            <a
              href="https://www.adsb.lol/docs/open-data/api"
              target="_blank"
              rel="noreferrer"
            >
              adsb.lol · ODbL
            </a>{" "}
            /{" "}
            <a
              href="https://thespacedevs.com/llapi"
              target="_blank"
              rel="noreferrer"
            >
              The Space Devs
            </a>
            <br />
            Countdowns follow published schedules, which may change.
          </footer>
        </section>
      )}
    </div>
  );
}
