import { useState } from "react";
import { useUtcClock } from "../../hooks/useUtcClock";
import { useAuroraStore } from "../../store/auroraStore";
import { useSceneStore } from "../../store/sceneStore";
import { objectClassification } from "../../utils/objectType";
import {
  elementEpoch,
  orbitalElementStatus,
  orbitDescription,
  propagatedTelemetry,
} from "../../utils/propagation";
import { formatAltitudeKm, formatSpeedKms } from "../../utils/measurements";
import { orbitExport } from "../../utils/orbitExport";
import { downloadText } from "../../utils/download";
import {
  conjunctionPeerName,
  conjunctionsForSatellite,
} from "../../utils/conjunctionLabels";
import {
  formatCountdownToTca,
  formatMissDistance,
  formatProbability,
} from "../../utils/format";

export function SatelliteInspector() {
  const now = useUtcClock(),
    selected = useAuroraStore((s) => s.selectedSatellite),
    conjunctions = useAuroraStore((s) => s.conjunctions),
    close = useAuroraStore((s) => s.closePanel);
  const scene = useSceneStore(),
    [error, setError] = useState("");
  if (!selected) return null;
  const telemetry = propagatedTelemetry(selected, now),
    classification = objectClassification(selected),
    epoch = elementEpoch(selected),
    related = conjunctionsForSatellite(selected, conjunctions);
  return (
    <section
      className="satellite-inspector pointer-events-auto"
      aria-label="Satellite details"
    >
      <header className="inspector-heading">
        <div>
          <span className="scene-eyebrow">ORBITAL OBJECT</span>
          <h2>Satellite details</h2>
        </div>
        <button
          aria-label="Close satellite details"
          onClick={() => close("satellite-detail")}
        >
          ×
        </button>
      </header>
      <div className="satellite-identity">
        <h3>{selected.name}</h3>
        <p>
          NORAD {selected.noradId} · {classification.label} ·{" "}
          {selected.orbitType}
        </p>
      </div>
      <p className="inspector-freshness">
        {orbitalElementStatus(selected, now)}
      </p>
      <dl className="satellite-metrics">
        <div>
          <dt>{telemetry ? "SGP4 altitude" : "Snapshot altitude"}</dt>
          <dd>
            {formatAltitudeKm(telemetry?.altitudeKm ?? selected.altitudeKm)}
          </dd>
        </div>
        <div>
          <dt>{telemetry ? "Velocity" : "Snapshot velocity"}</dt>
          <dd>
            {formatSpeedKms(telemetry?.velocityKms ?? selected.velocityKms, 3)}
          </dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd>
            {telemetry
              ? telemetry.periodMinutes.toFixed(1) + " min"
              : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>Inclination</dt>
          <dd>
            {telemetry
              ? telemetry.inclinationDegrees.toFixed(2) + "°"
              : "Unavailable"}
          </dd>
        </div>
      </dl>
      {!telemetry && (
        <p className="engineering-caution">
          Current position unavailable; snapshot values may be historical.
        </p>
      )}
      <div className="inspector-actions">
        <button
          disabled={!telemetry}
          aria-pressed={scene.following}
          onClick={() => {
            scene.setSatellitesOn(true);
            scene.setFollowing(!scene.following);
          }}
        >
          {scene.following ? "Stop following satellite" : "Follow satellite"}
        </button>
        <button
          disabled={!telemetry}
          onClick={() => scene.requestCamera("orbit")}
        >
          Fit orbit
        </button>
      </div>
      <details className="inspector-section" open>
        <summary>Position & orbit</summary>
        <dl className="inspector-properties">
          <dt>Position time · UTC</dt>
          <dd>
            {telemetry
              ? now.toISOString().replace("T", " ").slice(0, 19)
              : (selected.positionTimestamp ?? "Unknown")}
          </dd>
          <dt>Latitude / longitude</dt>
          <dd>
            {(telemetry?.lat ?? selected.lat).toFixed(2)}° /{" "}
            {(telemetry?.lon ?? selected.lon).toFixed(2)}°
          </dd>
          <dt>Orbit</dt>
          <dd>{orbitDescription(selected)}</dd>
          <dt>Element epoch</dt>
          <dd>{epoch?.toUTCString() ?? "Unavailable"}</dd>
        </dl>
        <div
          className="orbit-frame-choice"
          role="group"
          aria-label="Trajectory reference frame"
        >
          <button
            aria-pressed={scene.orbitFrame === "orbital"}
            onClick={() => scene.setOrbitFrame("orbital")}
          >
            Orbital space
          </button>
          <button
            aria-pressed={scene.orbitFrame === "earth-fixed"}
            onClick={() => scene.setOrbitFrame("earth-fixed")}
          >
            Earth-fixed
          </button>
        </div>
        <p className="engineering-note">
          SGP4 prediction from public elements. Representative model; attitude
          and size are illustrative.
        </p>
      </details>
      <details className="inspector-section">
        <summary>Public conjunction reports · {related.length}</summary>
        {related.length ? (
          related.map((c) => (
            <div className="satellite-report" key={c.id}>
              <strong>{conjunctionPeerName(selected, c)}</strong>
              <p>
                TCA {formatCountdownToTca(c.tca)} ·{" "}
                {formatMissDistance(c.missDistanceM)} · Pc{" "}
                {formatProbability(c.probability)}
              </p>
            </div>
          ))
        ) : (
          <p className="engineering-note">No matching public reports.</p>
        )}
      </details>
      <details className="inspector-section">
        <summary>Sources & export</summary>
        <p className="engineering-note">
          {classification.source}
          {selected.metadataFetchedAt
            ? " · fetched " + new Date(selected.metadataFetchedAt).toUTCString()
            : ""}
        </p>
        <p>
          <a
            href={`https://celestrak.org/NORAD/elements/gp.php?CATNR=${selected.noradId}&FORMAT=TLE`}
            target="_blank"
            rel="noreferrer"
          >
            CelesTrak elements ↗
          </a>
        </p>
        <div className="inspector-actions">
          <button
            disabled={!telemetry}
            onClick={() => {
              try {
                downloadText(
                  `norad-${selected.noradId}-trajectory.json`,
                  JSON.stringify(orbitExport(selected), null, 2),
                );
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Export failed");
              }
            }}
          >
            Export trajectory
          </button>
          <button
            disabled={!selected.tleLine1 || !selected.tleLine2}
            onClick={() =>
              downloadText(
                `${selected.noradId}.tle`,
                `${selected.name}\n${selected.tleLine1}\n${selected.tleLine2}\n`,
                "text/plain",
              )
            }
          >
            Source TLE
          </button>
        </div>
        <p className="engineering-note">
          One revolution, 25% past / 75% future, UTC samples in Earth-fixed
          metres. No covariance or maneuver modelling.
        </p>
        {error && <p role="alert">{error}</p>}
      </details>
    </section>
  );
}
