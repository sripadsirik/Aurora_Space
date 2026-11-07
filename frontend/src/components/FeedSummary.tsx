import { useEarth } from "../earth/store";
import { useUtcClock } from "../hooks/useUtcClock";
import { useAuroraStore } from "../store/auroraStore";
import { useAerospace } from "../aerospace/store";
import { describeFeedFreshness } from "../utils/feedFreshness";
export function FeedSummary() {
  const now = useUtcClock(),
    app = useAuroraStore(),
    air = useAerospace(),
    earth = useEarth();
  const rows = [
    {
      name: "Satellites",
      source: "CelesTrak",
      time: app.feedLastUpdated.satellites,
      count: app.satellites.length,
      minutes: 2,
    },
    {
      name: "Conjunctions",
      source: "Space-Track",
      time: app.feedLastUpdated.conjunctions,
      count: app.conjunctions.length,
      minutes: 490,
    },
    {
      name: "Space Weather",
      source: "NOAA SWPC",
      time: app.feedLastUpdated.spaceWeather,
      count: app.feedLastUpdated.spaceWeather ? 1 : 0,
      minutes: 5,
    },
    {
      name: "Aurora Forecast",
      source: "NOAA Ovation",
      time: app.feedLastUpdated.spaceWeather,
      count: app.feedLastUpdated.spaceWeather ? 2 : 0,
      minutes: 5,
    },
    {
      name: "Aircraft",
      source: air.region === "worldwide" ? "OpenSky Network" : "adsb.lol",
      time: air.feedInfo.aircraft.at
        ? new Date(air.feedInfo.aircraft.at)
        : null,
      count: air.aircraft.length,
      minutes: 1,
      disabled: !air.aircraftOn,
      error: air.feedInfo.aircraft.error || air.feedInfo.aircraft.stale,
    },
    {
      name: "Launches",
      source: "Launch Library 2",
      time: air.feedInfo.launches.at
        ? new Date(air.feedInfo.launches.at)
        : null,
      count: air.launches.length,
      minutes: 10,
      disabled: !air.launchesOn,
      error: air.feedInfo.launches.error || air.feedInfo.launches.stale,
    },
    {
      name: "Rocket positions",
      source: air.rocketTelemetry.source || "No source connected",
      time: air.rocketTelemetry.positions.length
        ? new Date(
            Math.max(...air.rocketTelemetry.positions.map((p) => p.observedAt)),
          )
        : null,
      count: air.rocketTelemetry.positions.filter(
        (p) => now.getTime() - p.observedAt <= 90000,
      ).length,
      minutes: 0.25,
      disabled: !air.followedLaunchId,
      error:
        air.rocketTelemetry.status === "stale" ||
        air.rocketTelemetry.status === "unavailable",
    },
    {
      name: "Traffic cameras",
      source: "IDOT · Caltrans · TfL · Fintraffic · NSW · LTA",
      time: earth.feed.at ? new Date(earth.feed.at) : null,
      count: earth.cameras.length,
      minutes: 6,
      disabled: !earth.camerasOn,
      error: earth.feed.error,
    },
  ];
  return (
    <div className="feed-summary" aria-label="Data layers status">
      {rows.map((r) => {
        const f = describeFeedFreshness(r.time, now, r.minutes, r.minutes * 3);
        return (
          <div key={r.name}>
            <span
              className={
                "feed-light " +
                (!r.disabled && !r.error && f.status === "live"
                  ? "feed-light--live"
                  : "")
              }
              aria-label={
                r.disabled
                  ? "Disabled"
                  : r.error
                    ? "Unavailable or stale"
                    : f.status
              }
            />
            <strong>{r.name}</strong>
            <span>{r.source}</span>
            <span>
              {r.disabled
                ? "Disabled"
                : r.error
                  ? `${f.label} · stale`
                  : f.label}
            </span>
            <b>{r.count.toLocaleString()}</b>
          </div>
        );
      })}
    </div>
  );
}
