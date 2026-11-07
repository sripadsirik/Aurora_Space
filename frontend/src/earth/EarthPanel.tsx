import { useEffect, useRef, useState, type FormEvent } from "react";
import { useEarth } from "./store";
import { useExplorer } from "../explorer/store";
import { parseCoordinates } from "./data";
import { useCameraFeeds } from "./useCameraFeeds";
import { cameraNetworks, illinoisPlaces, filterCameras } from "./cameraNetworks";
import { env } from "../utils/env";
import { useAuroraStore } from "../store/auroraStore";
import { useSceneStore } from "../store/sceneStore";
import { useUtcClock } from "../hooks/useUtcClock";
import { CameraMedia } from "./CameraMedia";
function endpoint(path: string) {
  if (!env.VITE_WS_URL) return null;
  const url = new URL(env.VITE_WS_URL);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "/api/earth/" + path;
  url.search = "";
  return url;
}
export function EarthPanel() {
  const earth = useEarth(),
    ui = useExplorer(),
    now = useUtcClock(),
    mode = useAuroraStore((s) => s.currentMode);
  const [query, setQuery] = useState(""),
    [places, setPlaces] = useState<
      { name: string; lat: number; lon: number }[]
    >([]),
    [searchError, setSearchError] = useState(""),
    [searching, setSearching] = useState(false),
    [cameraQuery, setCameraQuery] = useState(""),
    [videoOnly, setVideoOnly] = useState(false),
    [listLimit, setListLimit] = useState(150);
  const searchAbort = useRef<AbortController | null>(null);
  useEffect(() => () => searchAbort.current?.abort(), []);
  const { fetched, errors: cameraErrors, loading: camerasLoading } = useCameraFeeds(earth.camerasOn);
  const visibleCameras = filterCameras(earth.cameras, earth.cameraNetwork, earth.cameraArea)
    .filter(c => (!videoOnly || c.video) && `${c.name} ${c.providerName ?? ""} ${c.source}`.toLowerCase().includes(cameraQuery.trim().toLowerCase()));
  const selectedNetwork = cameraNetworks.find(n => n.id === earth.cameraNetwork);
  const selectedPlace = illinoisPlaces.find(p => p.id === earth.cameraArea);
  const selected = visibleCameras.find((c) => c.id === earth.selected);
  const firstVisible = visibleCameras[0]?.id ?? null;
  useEffect(() => {
    if (!selected && earth.selected !== firstVisible) earth.set({ selected: firstVisible });
  }, [selected, firstVisible, earth.selected, earth.set]);
  useEffect(() => setListLimit(150), [earth.cameraNetwork, earth.cameraArea, cameraQuery, videoOnly]);
  const search = async (e: FormEvent) => {
    e.preventDefault();
    searchAbort.current?.abort();
    setSearchError("");
    setPlaces([]);
    const coordinates = parseCoordinates(query);
    if (coordinates) {
      earth.locate(coordinates.lat, coordinates.lon, query);
      setSearching(false);
      return;
    }
    const url = endpoint("search");
    if (!url) {
      setSearchError(
        "Use latitude, longitude offline, or start the gateway for street search.",
      );
      return;
    }
    if (query.trim().length < 3) {
      setSearchError(
        "Enter at least three characters, or latitude, longitude.",
      );
      return;
    }
    const controller = new AbortController();
    searchAbort.current = controller;
    setSearching(true);
    url.searchParams.set("q", query.trim());
    try {
      const response = await fetch(url, {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(12000),
        ]),
      });
      if (!response.ok)
        throw Error(
          response.status === 429
            ? "Search is busy. Try again in a second."
            : "Place search is unavailable. Try coordinates instead.",
        );
      const rows = await response.json();
      if (!Array.isArray(rows)) throw Error("Place search is unavailable.");
      const results = rows
        .map((r) => ({
          name: String(r.display_name || ""),
          lat: Number(r.lat),
          lon: Number(r.lon),
        }))
        .filter(
          (r) =>
            r.name &&
            Number.isFinite(r.lat) &&
            Number.isFinite(r.lon) &&
            Math.abs(r.lat) <= 90 &&
            Math.abs(r.lon) <= 180,
        );
      if (!controller.signal.aborted) {
        setPlaces(results);
        if (!results.length) setSearchError("No matching streets or places.");
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setSearchError(
          error instanceof Error ? error.message : "Place search unavailable",
        );
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  };
  if (!ui.earthOpen || mode === "HELIO") return null;
  return (
    <section className="earth-panel" aria-label="Earth and public cameras">
      <header className="inspector-heading">
        <div>
          <span className="scene-eyebrow">EARTH OBSERVATION</span>
          <h2>Streets & cameras</h2>
        </div>
        <button
          aria-label="Close Earth workspace"
          onClick={() => ui.set({ earthOpen: false })}
        >
          ×
        </button>
      </header>
      <div
        className="inspector-actions"
        role="group"
        aria-label="Earth map style"
      >
        <button
          aria-pressed={earth.mapStyle === "imagery"}
          onClick={() => earth.set({ mapStyle: "imagery" })}
        >
          Satellite imagery
        </button>
        <button
          aria-pressed={earth.mapStyle === "streets"}
          onClick={() => earth.set({ mapStyle: "streets" })}
        >
          Street map
        </button>
      </div>
      <form onSubmit={search}>
        <label htmlFor="earth-search">Find a street, city or coordinates</label>
        <div className="earth-search">
          <input
            id="earth-search"
            placeholder="Street, city or 51.5074, -0.1278"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button disabled={searching}>{searching ? "…" : "Go"}</button>
        </div>
      </form>
      {searchError && (
        <p role="status" className="earth-note">
          {searchError}
        </p>
      )}
      {places.map((p, i) => (
        <button
          className="earth-place"
          key={i}
          onClick={() => earth.locate(p.lat, p.lon, p.name)}
        >
          {p.name}
        </button>
      ))}
      <p className="earth-note">
        Search ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors
        </a>
        . Street map shows road names; imagery detail depends on coverage. This
        is an overhead globe view.
      </p>
      <label className="earth-toggle">
        <input
          type="checkbox"
          checked={earth.camerasOn}
          onChange={(e) => earth.set({ camerasOn: e.target.checked })}
        />
        Public traffic cameras · connected networks
      </label>
      <p className="earth-note">
        Public road cameras and Chicago scenic webcams. Live video plays where the
        provider supplies a stream; other cameras publish snapshots. Coverage
        is limited to the connected networks. Still images refresh at the provider’s
        cadence; camera metadata is checked every minute and cached for up to five minutes.
      </p>
      {earth.camerasOn && (
        <>
          <label className="aerospace-field">Camera network
            <select aria-label="Camera network" value={earth.cameraNetwork} onChange={e => earth.set({ cameraNetwork: e.target.value, cameraArea: "", selected: null })}>
              <option value="all">All connected networks</option>
              {cameraNetworks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </label>
          <div className="inspector-actions" aria-label="Illinois camera shortcuts">
            {illinoisPlaces.map(p => <button key={p.id} aria-pressed={earth.cameraArea === p.id} onClick={() => {
              setCameraQuery("");
              earth.set({ cameraNetwork: "illinois", cameraArea: p.id, selected: null });
              earth.locate(p.lat, p.lon, p.name);
            }}>{p.name}</button>)}
          </div>
          {earth.cameraArea && <button onClick={() => earth.set({ cameraArea: "" })}>Show entire network</button>}
          {selectedPlace?.note && <p className="earth-note">{selectedPlace.note}</p>}
          {(earth.cameraArea === "uic" || earth.cameraArea === "uiuc") && (
            <p className="earth-note">
              These markers are nearby road cameras, not campus surveillance.
              {earth.cameraArea === "uic"
                ? <a href="https://today.uic.edu/uic-falconcam/" target="_blank" rel="noreferrer"> UIC’s official Falcon Cam ↗</a>
                : <><span> UIUC listed its campus cameras as unavailable when checked on Nov 5, 2026. </span><a href="https://illinois.edu/community/campus-cams/" target="_blank" rel="noreferrer">Official campus-camera status ↗</a></>}
            </p>
          )}
          <label className="aerospace-field">Find a road or camera
            <input value={cameraQuery} onChange={e => setCameraQuery(e.target.value)} placeholder="Road, intersection or camera name" />
          </label>
          <label className="earth-toggle"><input type="checkbox" checked={videoOnly} onChange={e => setVideoOnly(e.target.checked)} />Live video only</label>
          <div className="inspector-actions">
            {selectedNetwork && <button onClick={() => earth.locate(selectedNetwork.lat, selectedNetwork.lon, selectedNetwork.name)}>Show network on globe</button>}
            <button onClick={() => useSceneStore.getState().setSatellitesOn(false)}>Hide satellites</button>
          </div>
          <p className="earth-note" role="status">
            {camerasLoading ? "Loading public camera networks…" : `${visibleCameras.length.toLocaleString()} matching cameras · ${earth.cameras.length.toLocaleString()} total`}
            {fetched && ` · Oldest catalog fetch ${Math.max(0, Math.floor((now.getTime() - Date.parse(fetched)) / 1000))}s ago`}
          </p>
          {!!cameraErrors.length && <details className="earth-note"><summary>{cameraErrors.length} camera feeds unavailable or cached</summary>{cameraErrors.map(e => <p key={e}>{e}</p>)}</details>}
          {!camerasLoading && !visibleCameras.length && <p>{videoOnly ? "No published live video found for these filters. Turn off Live video only to see snapshots." : "No published camera images found in this area. Try the full network or another nearby place."}</p>}
          {selected && (
            <article className="earth-camera">
              <h3>{selected.name}</h3>
              {selected.providerName && <p className="earth-note">Provider location: {selected.providerName}</p>}
              {selected.coverageNote && <p className="earth-note">{selected.coverageNote}</p>}
              {selected.imageStale && <p className="earth-note">Provider reports this image is delayed or stale.</p>}
              <CameraMedia key={`${selected.id}:${selected.video?.url ?? ""}`} camera={selected} />
              <p className="earth-note">
                {selected.source} · {selected.observedAt
                  ? `Image captured ${new Date(selected.observedAt).toUTCString()}`
                  : selected.image ? "Image capture time not supplied; catalog refresh is not the image capture time." : "Live video availability is controlled by the provider."}
                {selected.reportedAgeMinutes !== undefined && ` Provider reported image age: ${selected.reportedAgeMinutes} min at catalog update.`}
              </p>
              <div className="inspector-actions">
                <button
                  onClick={() =>
                    earth.locate(selected.lat, selected.lon, selected.name)
                  }
                >
                  Go to camera
                </button>
                {selected.image && <a href={selected.image} target="_blank" rel="noreferrer">
                  Open provider image ↗
                </a>}
              </div>
            </article>
          )}
          <div className="earth-camera-list">
            {visibleCameras.slice(0, listLimit).map((c) => (
              <button
                key={c.id}
                aria-label={c.name}
                aria-pressed={earth.selected === c.id}
                onClick={() => {
                  earth.set({ selected: c.id });
                  earth.locate(c.lat, c.lon, c.name);
                }}
              >
                {c.name}
                <small className="earth-camera-kind">{c.video ? "Live video" : "Snapshot"}</small>
              </button>
            ))}
          </div>
          {visibleCameras.length > listLimit && <button onClick={() => setListLimit(n => n + 150)}>Show more cameras ({visibleCameras.length - listLimit} remaining)</button>}
          <p className="earth-note">Showing {Math.min(listLimit, visibleCameras.length)} of {visibleCameras.length} matches. Multiple directions can share one map marker; choose a view in the list.</p>
          <p className="earth-note">Sources: {cameraNetworks.map(n => <a key={n.id} href={n.url} target="_blank" rel="noreferrer">{n.source} ↗ · </a>)}</p>
        </>
      )}
    </section>
  );
}
