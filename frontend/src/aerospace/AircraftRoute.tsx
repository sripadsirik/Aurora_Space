import { useEffect, useState } from "react";
import { env } from "../utils/env";
import type { Aircraft } from "./data";
interface Airport {
  name: string;
  iata_code?: string;
  icao_code?: string;
  municipality?: string;
}
export function AircraftRoute({ aircraft }: { aircraft: Aircraft }) {
  const [route, setRoute] = useState<{
      origin: Airport;
      destination: Airport;
    } | null>(null),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    setRoute(null);
    if (!env.VITE_WS_URL || !aircraft.name) return;
    const controller = new AbortController();
    setLoading(true);
    const url = new URL(env.VITE_WS_URL);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = "/api/aerospace/route/" + encodeURIComponent(aircraft.name);
    url.search = "";
    fetch(url, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((body) => {
        const r = body.data?.response?.flightroute;
        if (
          !controller.signal.aborted &&
          r?.origin?.name &&
          r?.destination?.name
        )
          setRoute(r);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [aircraft.name]);
  return (
    <div className="aircraft-route">
      <dl>
        <div>
          <dt>Listed departure</dt>
          <dd>
            {route
              ? `${route.origin.iata_code || route.origin.icao_code || "—"} · ${route.origin.municipality || route.origin.name}`
              : loading
                ? "Looking up…"
                : "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Listed destination</dt>
          <dd>
            {route
              ? `${route.destination.iata_code || route.destination.icao_code || "—"} · ${route.destination.municipality || route.destination.name}`
              : loading
                ? "Looking up…"
                : "Unknown"}
          </dd>
        </div>
      </dl>
      <p className="aerospace-note">
        {route
          ? "adsbdb callsign route · may differ from this flight. Landing is not confirmed or predicted."
          : "No verified route available. Position and heading do not establish departure or destination."}
      </p>
    </div>
  );
}
