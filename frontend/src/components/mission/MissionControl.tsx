import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMissionStore } from "../../mission/store";
import { demoScenario } from "../../mission/scenario";
import {
  createArchive,
  engineeringReport,
  readArchive,
  validateScenario,
} from "../../mission/archive";
import { parseReviewImport } from "../../utils/conjunctionReview";
import { scenarioFromCdm } from "../../mission/cdm";
import {
  replayFeeds,
  useFeedCapture,
  validateCapture,
  type FeedEvent,
} from "../../mission/feedCapture";
import { useAuroraStore } from "../../store/auroraStore";
import { useMissionAnalysis } from "../../mission/useMissionAnalysis";
import { downloadText } from "../../utils/download";
import { EncounterPlot, SeparationPlot, OrbitReplay } from "./MissionCharts";
import { distance, leadLabel, pcLabel, utc } from "./format";
import {
  DecisionBanner,
  ManeuverDesigner,
  TradeSpacePanel,
  type DesignRequest,
} from "./MissionDecision";
import { timelineLeadSeconds } from "../../mission/analysis";
import { pcThresholds } from "../../mission/tradeSpace";
import "./mission.css";
import "./mission-shell.css";
export function MissionLauncher() {
  const launch = useMissionStore((s) => s.launch);
  return (
    <button className="flight-launch" onClick={() => launch()}>
      <span>◈</span> Mission lab <span className="flight-launch-arrow">↗</span>
    </button>
  );
}
export function MissionControl() {
  const open = useMissionStore((s) => s.open);
  return open ? <MissionWorkspace /> : null;
}
function MissionWorkspace() {
  const savedSession = useRef(useMissionStore.getState().session).current;
  const scenario = useMissionStore((s) => s.scenario),
    launch = useMissionStore((s) => s.launch),
    close = useMissionStore((s) => s.close);
  const { analysis, busy, duration, analysisError, retry } =
    useMissionAnalysis(scenario);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"encounter" | "maneuvers" | "evidence">(
    savedSession?.tab ?? "encounter",
  );
  const scenarioLead = timelineLeadSeconds(scenario);
  const [selected, setSelected] = useState(savedSession?.selected ?? "coast"),
    [seconds, setSeconds] = useState(savedSession?.seconds ?? -scenarioLead),
    [playing, setPlaying] = useState(false),
    [rate, setRate] = useState(60);
  const [notes, setNotes] = useState(savedSession?.notes ?? ""),
    [hash, setHash] = useState(savedSession?.hash ?? ""),
    [notice, setNotice] = useState("");
  const [radii, setRadii] = useState<[number, number]>([4, 2]);
  const [draft, setDraft] = useState<DesignRequest | null>(null);
  const [importedEvents, setImportedEvents] = useState<FeedEvent[] | null>(
      savedSession?.importedEvents ?? null,
    ),
    [feedIndex, setFeedIndex] = useState(0);
  const capture = useFeedCapture();
  const input = useRef<HTMLInputElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const [settings, setSettings] = useState(scenario.config);
  useEffect(() => {
    useMissionStore.setState({
      session: { notes, selected, seconds, hash, importedEvents, tab },
    });
  }, [notes, selected, seconds, hash, importedEvents, tab]);
  useEffect(() => {
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        close();
        return;
      }
      const target = e.target as HTMLElement;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
      )
        return;
      if (e.key === " " && target.tagName !== "BUTTON") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (["1", "2", "3"].includes(e.key))
        setTab(
          (["encounter", "maneuvers", "evidence"] as const)[Number(e.key) - 1],
        );
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);
  useEffect(() => {
    setError("");
    setSettings(scenario.config);
    setRadii([scenario.primary.radiusM, scenario.secondary.radiusM]);
    setPlaying(false);
    setSeconds((s) =>
      Math.min(
        scenario.config.encounterWindowSeconds,
        Math.max(-timelineLeadSeconds(scenario), s),
      ),
    );
  }, [scenario]);
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        dt = (now - previous) / 1000;
      previous = now;
      setSeconds((s) => {
        const next = Math.min(
          s + dt * rate,
          scenario.config.encounterWindowSeconds,
        );
        if (next === scenario.config.encounterWindowSeconds) setPlaying(false);
        return next;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [playing, rate, scenario.config.encounterWindowSeconds]);
  const candidate =
    analysis?.candidates.find((c) => c.id === selected) ??
    analysis?.candidates[0];
  const timelineLead = candidate?.burnLeadSeconds ?? scenarioLead;
  useEffect(() => {
    setSeconds((t) => Math.max(-timelineLead, t));
    setPlaying(false);
  }, [timelineLead]);
  const events = importedEvents ?? capture.events;
  const replay = useMemo(() => {
    try {
      return replayFeeds(events, Math.min(feedIndex, events.length - 1));
    } catch {
      return null;
    }
  }, [events, feedIndex]);
  const applySettings = () => {
    try {
      const next = validateScenario({ ...scenario, config: settings });
      setHash("");
      launch(next);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 30_000_000) throw new Error("Import limit: 30 MB");
      const text = await file.text();
      if (!text.trim().startsWith("{")) {
        const reports = parseReviewImport(text, file.name);
        const next = scenarioFromCdm(reports[0], radii);
        launch(next);
        setSelected("coast");
        setSeconds(-timelineLeadSeconds(next));
        setHash("");
        setNotes("");
        setImportedEvents(null);
      } else {
        const archive = await readArchive(text);
        const restored =
          archive.capture === null ? null : validateCapture(archive.capture);
        launch(archive.scenario);
        setNotes(archive.notes);
        setSelected(archive.selectedCandidate);
        setSeconds(archive.replaySeconds);
        setHash(archive.sha256);
        setImportedEvents(restored);
        setFeedIndex(0);
      }
      setDraft(null);
      setNotice(`Loaded ${file.name}`);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  };
  const exportArchive = async () => {
    try {
      const archive = await createArchive(
        scenario,
        notes,
        candidate?.id ?? "coast",
        seconds,
        events.length ? events : null,
      );
      downloadText(
        `aurora-${scenario.id.replace(/[^\w-]/g, "_")}.json`,
        JSON.stringify(archive, null, 2),
      );
      setHash(archive.sha256);
      setNotice(
        "Archive exported · inputs and analyst session protected by SHA-256",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const simulateDesign = (request: DesignRequest) => {
    const parts = (["R", "T", "N"] as const)
      .map((axis, i) =>
        request.deltaVRtn[i]
          ? `${axis} ${request.deltaVRtn[i] > 0 ? "+" : "−"}${Math.abs(request.deltaVRtn[i]).toFixed(3)}`
          : "",
      )
      .filter(Boolean);
    const id = `custom-${Date.now().toString(36)}`;
    const custom = {
      id,
      label: `Design · ${parts.join(" ")} m/s · ${leadLabel(request.burnLeadSeconds)}`,
      deltaVRtn: request.deltaVRtn,
      burnLeadSeconds: request.burnLeadSeconds,
    };
    try {
      launch(
        validateScenario({
          ...scenario,
          customManeuvers: [...(scenario.customManeuvers ?? []), custom].slice(
            -20,
          ),
        }),
      );
      setDraft(request);
      setSelected(id);
      setHash("");
      setNotice(`Simulating ${custom.label} with full RK4…`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const removeDesign = (id: string) => {
    launch({
      ...scenario,
      customManeuvers: (scenario.customManeuvers ?? []).filter(
        (m) => m.id !== id,
      ),
    });
    if (selected === id) setSelected("coast");
    setHash("");
  };
  const record = () => {
    setImportedEvents(null);
    capture.start();
    const s = useAuroraStore.getState();
    const raw = [
      { type: "satellites", payload: s.satellites },
      { type: "conjunctions", payload: s.conjunctions },
      { type: "spaceWeather", payload: s.spaceWeather },
    ];
    raw.forEach((m) =>
      useFeedCapture.getState().append(JSON.parse(JSON.stringify(m))),
    );
    setFeedIndex(0);
  };
  const progress =
    ((seconds + timelineLead) /
      (timelineLead + scenario.config.encounterWindowSeconds)) *
    100;
  return (
    <section className="flight-shell" aria-label="Mission analysis workspace">
      <header className="flight-header">
        <div className="flight-brand">
          <span className="flight-wordmark">
            AURORA
            <span className="flight-wordmark-dot" />
          </span>
          <span className="flight-brand-divider" />
          <div className="flight-product-name">
            Mission lab<span>ORBITAL INTELLIGENCE</span>
          </div>
        </div>
        <div className="flight-header-actions">
          <button
            onClick={() => {
              launch(demoScenario());
              setDraft(null);
              setSelected("coast");
              setNotes("");
              setHash("");
              setSeconds(-2700);
              setImportedEvents(null);
            }}
          >
            Example mission
          </button>
          <button onClick={() => input.current?.click()}>Import</button>
          <button
            className="flight-primary-button"
            onClick={() => void exportArchive()}
          >
            Export archive ↗
          </button>
          <button aria-label="Close mission lab" onClick={close}>
            ✕
          </button>
          <input
            ref={input}
            type="file"
            accept=".json,.cdm,.kvn,.txt"
            className="sr-only"
            onChange={importFile}
            aria-label="Import mission archive or CDM"
          />
        </div>
      </header>
      <div className="flight-body">
        <aside className="flight-sidebar">
          <div className="flight-sidebar-label">WORKSPACE</div>
          <div className="flight-mission-name">{scenario.name}</div>
          <span className={`flight-kind ${scenario.kind}`}>
            {scenario.kind === "synthetic"
              ? "SYNTHETIC SCENARIO"
              : "IMPORTED CDM / SCENARIO"}
          </span>
          <nav className="flight-tabs" aria-label="Analysis stages">
            {(["encounter", "maneuvers", "evidence"] as const).map((t, i) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                aria-current={tab === t ? "page" : undefined}
                onClick={() => setTab(t)}
              >
                <span>0{i + 1}</span>
                {t === "encounter"
                  ? "Encounter geometry"
                  : t === "maneuvers"
                    ? "Maneuver trade study"
                    : "Evidence & replay"}
                <span>↗</span>
              </button>
            ))}
          </nav>
          <div className="flight-object">
            <span className="flight-dot primary" />
            <div>
              <small>PRIMARY</small>
              <strong>{scenario.primary.name}</strong>
              <span>
                {scenario.primary.id} · radius {scenario.primary.radiusM} m
              </span>
            </div>
          </div>
          <div className="flight-object">
            <span className="flight-dot secondary" />
            <div>
              <small>SECONDARY</small>
              <strong>{scenario.secondary.name}</strong>
              <span>
                {scenario.secondary.id} · radius {scenario.secondary.radiusM} m
              </span>
            </div>
          </div>
          <dl className="flight-meta">
            <dt>STATE EPOCH</dt>
            <dd>{utc(scenario.epoch)}</dd>
            <dt>REFERENCE FRAME</dt>
            <dd>{scenario.frame} · SI units</dd>
            <dt>NUMERICAL MODEL</dt>
            <dd>RK4 / {scenario.config.forceModel}</dd>
            <dt>SCREENING SET</dt>
            <dd>{scenario.screeningObjects.length} additional objects</dd>
          </dl>
          <div className="flight-sidebar-foot">
            <span className={busy ? "flight-pulse" : ""}>
              {busy
                ? "● COMPUTING"
                : analysisError
                  ? "● ANALYSIS FAILED"
                  : "● ANALYSIS READY"}
            </span>
            <small>
              {analysis
                ? `${analysis.modelVersion} · ${duration.toFixed(0)} ms`
                : "Deterministic inputs · isolated worker"}
            </small>
          </div>
        </aside>
        <main className="flight-main">
          <div className={`flight-title-row flight-hero ${tab}`}>
            <svg
              className="flight-hero-art"
              viewBox="0 0 430 240"
              fill="none"
              aria-hidden="true"
            >
              <ellipse
                cx="220"
                cy="120"
                rx="175"
                ry="61"
                transform="rotate(-24 220 120)"
              />
              <ellipse
                cx="220"
                cy="120"
                rx="151"
                ry="78"
                transform="rotate(37 220 120)"
              />
              <circle cx="220" cy="120" r="39" />
              <path d="M220 33V207M133 120H307" strokeDasharray="3 7" />
              <circle className="flight-orbit-point" cx="358" cy="52" r="4" />
              <circle
                className="flight-orbit-point secondary"
                cx="113"
                cy="28"
                r="3"
              />
            </svg>
            <div>
              <div className="flight-section-label">
                {tab === "encounter"
                  ? "01 / ENCOUNTER ANALYSIS"
                  : tab === "maneuvers"
                    ? "02 / MANEUVER DESIGN"
                    : "03 / EVIDENCE & REPLAY"}
              </div>
              <h1 ref={heading} tabIndex={-1}>
                {tab === "encounter"
                  ? scenario.name
                  : tab === "maneuvers"
                    ? "Find the better trajectory."
                    : "Every result, accounted for."}
              </h1>
              <p className="flight-hero-description">
                {tab === "encounter"
                  ? scenario.description
                  : tab === "maneuvers"
                    ? "Explore the trade space. Design an impulse. Verify the outcome."
                    : "Preserve your assumptions, replay the data, and share a reproducible investigation."}
              </p>
            </div>
            <span className="flight-compute-status">
              {busy
                ? "Calculating…"
                : analysis
                  ? "COMPUTED LOCALLY"
                  : analysisError
                    ? "ANALYSIS FAILED"
                    : "INPUT REVIEW"}
            </span>
          </div>
          {(error || analysisError) && (
            <div className="flight-error" role="alert">
              <span>{error || analysisError}</span>
              {analysisError && <button onClick={retry}>Retry analysis</button>}
            </div>
          )}
          {notice && (
            <div className="flight-notice" role="status">
              {notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          {analysis && candidate && (
            <>
              <div className="flight-metrics">
                <Metric
                  label="BASELINE MISS DISTANCE"
                  value={distance(analysis.encounter.missDistanceM)}
                  note="Linear encounter geometry"
                />
                <Metric
                  label="COMPUTED BASELINE Pc"
                  value={pcLabel(analysis.encounter.pc)}
                  note="2D Gaussian · circular hard body"
                />
                <Metric
                  label="RELATIVE VELOCITY"
                  value={`${(analysis.encounter.relativeSpeedMs / 1000).toFixed(2)} km/s`}
                  note="At supplied state epoch"
                />
                <Metric
                  label="SELECTED CANDIDATE MISS"
                  value={distance(candidate.missDistanceM)}
                  note={
                    candidate.id === "coast"
                      ? "Numerical coast solution"
                      : candidate.label
                  }
                  accent
                />
              </div>
              <DecisionBanner
                decision={analysis.decision}
                candidates={analysis.candidates}
                selected={candidate.id}
                onReview={(id) => {
                  setSelected(id);
                  setTab("maneuvers");
                }}
              />
              {tab === "encounter" && (
                <div className="flight-encounter-layout">
                  <section className="flight-card flight-chart-card">
                    <div className="flight-card-heading">
                      <h3>Encounter plane</h3>
                      <span>UNCERTAINTY + GEOMETRY</span>
                    </div>
                    <EncounterPlot
                      encounter={analysis.encounter}
                      candidate={candidate}
                      scenario={scenario}
                    />
                    <div className="flight-chart-caption">
                      <span>
                        <i className="amber" />
                        Baseline covariance
                      </span>
                      <span>
                        <i className="mint" />
                        Candidate geometry only
                      </span>
                      <span>Projected at closest approach</span>
                    </div>
                  </section>
                  <section className="flight-card flight-context">
                    <div className="flight-section-label">
                      ASSESSMENT CONTEXT
                    </div>
                    <h3>Know what the data supports.</h3>
                    <dl>
                      <dt>Combined hard-body radius</dt>
                      <dd>{analysis.encounter.hardBodyRadiusM} m</dd>
                      <dt>Major / minor uncertainty · 1σ</dt>
                      <dd>
                        {analysis.encounter.ellipse.major.toFixed(1)} /{" "}
                        {analysis.encounter.ellipse.minor.toFixed(1)} m
                      </dd>
                      <dt>Quadrature convergence difference</dt>
                      <dd>
                        {analysis.encounter.integrationError.toExponential(2)}
                      </dd>
                      <dt>Position covariance checks</dt>
                      <dd className="mint-text">
                        Symmetric · positive definite
                      </dd>
                    </dl>
                    <p>
                      Baseline probability assumes independent Gaussian errors
                      and a short encounter. Mathematical validity does not
                      establish covariance realism.
                    </p>
                    <button
                      className="flight-primary-button"
                      onClick={() => setTab("maneuvers")}
                    >
                      Explore maneuver candidates →
                    </button>
                    <h4>Report evolution</h4>
                    {scenario.revisions.map((r) => (
                      <div className="flight-revision" key={r.id}>
                        <span>
                          {r.id}
                          <small>{utc(r.issuedAt)}</small>
                        </span>
                        <strong>
                          {r.missDistanceM === null
                            ? "Unavailable"
                            : distance(r.missDistanceM)}
                          <small>
                            Supplied Pc{" "}
                            {r.suppliedPc === null
                              ? "unavailable"
                              : r.suppliedPc.toExponential(1)}
                          </small>
                        </strong>
                      </div>
                    ))}
                  </section>
                </div>
              )}
              {tab === "encounter" && (
                <div className="flight-bottom-grid">
                  <section className="flight-card">
                    <div className="flight-card-heading">
                      <h3>Orbit replay</h3>
                      <span>COMPUTED TRAJECTORIES</span>
                    </div>
                    <OrbitReplay candidate={candidate} seconds={seconds} />
                  </section>
                  <section className="flight-card">
                    <div className="flight-card-heading">
                      <h3>Separation history</h3>
                      <span>LOGARITHMIC DISTANCE</span>
                    </div>
                    <SeparationPlot candidate={candidate} seconds={seconds} />
                  </section>
                </div>
              )}
              {tab === "maneuvers" && (
                <>
                  {analysis.tradeSpace ? (
                    <TradeSpacePanel
                      trade={analysis.tradeSpace}
                      scenario={scenario}
                      candidates={analysis.candidates}
                      selected={candidate.id}
                      recommendedId={analysis.decision.recommendedId}
                      onDesign={simulateDesign}
                      onSelect={setSelected}
                    />
                  ) : (
                    <div className="flight-error" role="alert">
                      Trade space unavailable: {analysis.tradeSpaceError}
                    </div>
                  )}
                  <section className="flight-card flight-trades">
                    <div className="flight-card-heading">
                      <h3>Candidate comparison</h3>
                      <span>
                        {analysis.candidates.length} FULL RK4 TRAJECTORIES
                      </span>
                    </div>
                    <div className="flight-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Candidate / RTN impulse</th>
                            <th>Burn</th>
                            <th>Δv</th>
                            <th>Ideal fuel</th>
                            <th>Miss distance</th>
                            <th>Computed Pc</th>
                            <th>ΔTCA</th>
                            <th>Displacement¹</th>
                            <th>Screening²</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.candidates.map((c) => (
                            <tr
                              key={c.id}
                              className={
                                c.id === candidate.id ? "selected" : ""
                              }
                            >
                              <td>
                                <button
                                  onClick={() => setSelected(c.id)}
                                  aria-pressed={c.id === candidate.id}
                                >
                                  <span className="flight-radio" />
                                  {c.label}
                                  {c.id === analysis.decision.recommendedId && (
                                    <span className="flight-badge">
                                      RECOMMENDED
                                    </span>
                                  )}
                                </button>
                                {c.custom && (
                                  <button
                                    className="flight-row-remove"
                                    aria-label={`Remove ${c.label}`}
                                    onClick={() => removeDesign(c.id)}
                                  >
                                    ✕
                                  </button>
                                )}
                              </td>
                              <td>
                                {c.deltaVMs > 0
                                  ? leadLabel(c.burnLeadSeconds)
                                  : "—"}
                              </td>
                              <td>
                                {c.deltaVMs.toFixed(c.deltaVMs < 0.1 ? 3 : 2)}{" "}
                                m/s
                              </td>
                              <td>{(c.fuelKg * 1000).toFixed(2)} g</td>
                              <td className="mint-text">
                                {distance(c.missDistanceM)}
                                {c.boundaryMinimum ? " *" : ""}
                              </td>
                              <td
                                title={c.pcReason}
                                className={
                                  c.computedPc != null &&
                                  c.computedPc <= analysis.decision.pcGoal
                                    ? "mint-text"
                                    : c.computedPc != null &&
                                        c.computedPc >
                                          analysis.decision.pcActionThreshold
                                      ? "amber-text"
                                      : ""
                                }
                              >
                                {pcLabel(c.computedPc)}
                              </td>
                              <td>{c.tcaOffsetSeconds.toFixed(2)} s</td>
                              <td>{distance(c.displacementAtEpochM)}</td>
                              <td>
                                {c.screening.length
                                  ? `${c.screening.filter((s) => s.belowThreshold).length} / ${c.screening.length} flagged`
                                  : "No objects supplied"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="flight-table-note">
                      ¹ Position shift at original epoch, relative to supplied
                      state. ² Distance threshold within supplied screening set
                      and time window. * Minimum occurs at search boundary.
                      Candidate Pc uses linearized full-state covariance and the
                      configured burn execution error. Missing covariance or
                      burn uncertainty is shown as unavailable.
                    </p>
                  </section>
                  <div className="flight-bottom-grid">
                    <section className="flight-card">
                      <div className="flight-card-heading">
                        <h3>Separation history</h3>
                        <span>{candidate.label}</span>
                      </div>
                      <SeparationPlot candidate={candidate} seconds={seconds} />
                    </section>
                    <ManeuverDesigner
                      scenario={scenario}
                      draft={draft}
                      onSimulate={simulateDesign}
                      busy={busy}
                    />
                  </div>
                  <div className="flight-bottom-grid">
                    <section className="flight-card flight-settings">
                      <div className="flight-card-heading">
                        <h3>Spacecraft & model</h3>
                        <span>EDIT → RECOMPUTE</span>
                      </div>
                      <div className="flight-settings-grid">
                        <label>
                          Burn error 1σ · m/s
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.001"
                            placeholder="Unspecified"
                            value={settings.burnExecutionSigmaMs ?? ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                burnExecutionSigmaMs:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        {(
                          [
                            {
                              key: "burnLeadSeconds",
                              label: "Burn lead · seconds",
                              min: 60,
                              max: 7200,
                            },
                            {
                              key: "maxDeltaVMs",
                              label: "Maximum Δv · m/s",
                              min: 0.01,
                              max: 20,
                            },
                            {
                              key: "massKg",
                              label: "Wet mass · kg",
                              min: 1,
                              max: 1e6,
                            },
                            {
                              key: "ispSeconds",
                              label: "Specific impulse · s",
                              min: 1,
                              max: 1e5,
                            },
                            {
                              key: "screeningDistanceM",
                              label: "Screening threshold · m",
                              min: 1,
                              max: 1e6,
                            },
                            {
                              key: "stepSeconds",
                              label: "Integrator step · s",
                              min: 1,
                              max: 30,
                            },
                          ] as const
                        ).map((f) => (
                          <label key={f.key}>
                            {f.label}
                            <input
                              type="number"
                              min={f.min}
                              max={f.max}
                              step="any"
                              value={settings[f.key]}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  [f.key]: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                        ))}
                        {(
                          [
                            [
                              "pcActionThreshold",
                              "Pc action threshold",
                              "action",
                            ],
                            ["pcGoal", "Pc goal after maneuver", "goal"],
                          ] as const
                        ).map(([key, label, fallback]) => (
                          <label key={key}>
                            {label}
                            <input
                              type="number"
                              min="1e-12"
                              max="1"
                              step="any"
                              value={
                                settings[key] ??
                                pcThresholds(scenario)[fallback]
                              }
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  [key]: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                        ))}
                        <label>
                          Force model
                          <select
                            value={settings.forceModel}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                forceModel: e.target.value as "J2" | "two-body",
                              })
                            }
                          >
                            <option>J2</option>
                            <option value="two-body">Two-body</option>
                          </select>
                        </label>
                      </div>
                      <button
                        className="flight-primary-button"
                        onClick={applySettings}
                      >
                        Recompute trade study ↗
                      </button>
                    </section>
                    <section className="flight-card">
                      <div className="flight-card-heading">
                        <h3>Orbit replay</h3>
                        <span>DRAG TO ROTATE</span>
                      </div>
                      <OrbitReplay candidate={candidate} seconds={seconds} />
                    </section>
                  </div>
                  <section className="flight-card flight-screening">
                    <div className="flight-card-heading">
                      <h3>Secondary encounter screening</h3>
                      <span>SELECTED CANDIDATE</span>
                    </div>
                    {candidate.screening.length ? (
                      candidate.screening.map((s) => (
                        <div key={s.objectId}>
                          <strong>{s.objectId}</strong>
                          <span>{distance(s.minimumDistanceM)}</span>
                          <span>{utc(scenario.epoch, s.secondsFromEpoch)}</span>
                          <span
                            className={
                              s.belowThreshold ? "amber-text" : "mint-text"
                            }
                          >
                            {s.belowThreshold
                              ? "BELOW DISTANCE THRESHOLD"
                              : "ABOVE DISTANCE THRESHOLD"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p>
                        No screening objects supplied. Add explicit state
                        vectors to the scenario archive to enable this check.
                      </p>
                    )}
                  </section>
                </>
              )}
              {tab === "evidence" && (
                <div className="flight-evidence-grid">
                  <section className="flight-card flight-evidence">
                    <div className="flight-section-label">REPRODUCIBILITY</div>
                    <h3>One archive. The complete investigation.</h3>
                    <p>
                      Export the scenario, configuration, source reports,
                      analyst notes, feed capture and replay position. Import
                      recomputes results using the declared model version and
                      verifies the input checksum.
                    </p>
                    <dl>
                      <dt>Source</dt>
                      <dd>{scenario.source.name}</dd>
                      <dt>Reference</dt>
                      <dd>{scenario.source.reference}</dd>
                      <dt>Last archive SHA-256</dt>
                      <dd className="flight-hash">
                        {hash || "Created when archive is exported"}
                      </dd>
                    </dl>
                    <div className="flight-inline-actions">
                      <button
                        className="flight-primary-button"
                        onClick={() => void exportArchive()}
                      >
                        Export reproducible archive
                      </button>
                      <button
                        onClick={() =>
                          downloadText(
                            "aurora-engineering-report.md",
                            engineeringReport(scenario, analysis, notes),
                            "text/markdown",
                          )
                        }
                      >
                        Engineering report ↗
                      </button>
                    </div>
                    <label className="flight-notes">
                      Analyst notes
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Record assumptions, candidate rationale and outstanding data requests."
                      />
                    </label>
                    <details>
                      <summary>Model assumptions & supported scope</summary>
                      <ul>
                        {analysis.assumptions.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </details>
                    <details>
                      <summary>Import a provider CDM</summary>
                      <p>
                        Supported: CCSDS KVN; both states in GCRF or EME2000; km
                        / km/s states, m² RTN position covariance, UTC. Enter
                        explicit hard-body radius assumptions before import.
                      </p>
                      <div className="flight-settings-grid">
                        {radii.map((r, i) => (
                          <label key={i}>
                            Object {i + 1} radius · m
                            <input
                              type="number"
                              min="0.01"
                              max="1000"
                              value={r}
                              onChange={(e) =>
                                setRadii(
                                  radii.map((v, j) =>
                                    i === j ? Number(e.target.value) : v,
                                  ) as [number, number],
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <button onClick={() => input.current?.click()}>
                        Import CDM
                      </button>
                      <button
                        onClick={() => {
                          try {
                            launch(
                              validateScenario({
                                ...scenario,
                                primary: {
                                  ...scenario.primary,
                                  radiusM: radii[0],
                                },
                                secondary: {
                                  ...scenario.secondary,
                                  radiusM: radii[1],
                                },
                              }),
                            );
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Apply radius assumptions to current scenario
                      </button>
                    </details>
                  </section>
                  <section className="flight-card flight-evidence">
                    <div className="flight-section-label">FEED RESILIENCE</div>
                    <h3>Capture. Disconnect. Replay.</h3>
                    <p>
                      Capture begins with the current dashboard snapshot, then
                      records validated arriving messages. Disconnect closes the
                      live socket while preserving the last received data.
                      Reconnect requests the gateway snapshot.
                    </p>
                    <div className="flight-feed-state">
                      <span
                        className={capture.paused ? "amber-text" : "mint-text"}
                      >
                        {capture.paused
                          ? "FEED DISCONNECTED"
                          : "LIVE CONNECTION PERMITTED"}
                      </span>
                      <span>
                        {capture.recording
                          ? "● RECORDING"
                          : `${events.length} CAPTURED EVENTS`}
                      </span>
                    </div>
                    <div className="flight-inline-actions">
                      <button
                        onClick={capture.recording ? capture.stop : record}
                      >
                        {capture.recording ? "Stop capture" : "Start capture"}
                      </button>
                      <button
                        onClick={() => capture.setPaused(!capture.paused)}
                      >
                        {capture.paused ? "Reconnect feed" : "Disconnect feed"}
                      </button>
                    </div>
                    {capture.notice && <p role="status">{capture.notice}</p>}
                    {events.length > 0 && (
                      <>
                        <label className="flight-feed-slider">
                          Replay event{" "}
                          {Math.min(feedIndex, events.length - 1) + 1} /{" "}
                          {events.length}
                          <input
                            aria-label="Captured feed replay sequence"
                            type="range"
                            min="0"
                            max={events.length - 1}
                            value={Math.min(feedIndex, events.length - 1)}
                            onChange={(e) =>
                              setFeedIndex(Number(e.target.value))
                            }
                          />
                        </label>
                        <dl>
                          <dt>Captured UTC</dt>
                          <dd>{replay?.asOf ?? "—"}</dd>
                          <dt>Catalog snapshot</dt>
                          <dd>
                            {Array.isArray(replay?.satellites)
                              ? `${replay.satellites.length.toLocaleString()} objects`
                              : "Not yet received"}
                          </dd>
                          <dt>Conjunction snapshot</dt>
                          <dd>
                            {Array.isArray(replay?.conjunctions)
                              ? `${replay.conjunctions.length} reports`
                              : "Not yet received"}
                          </dd>
                          <dt>Weather snapshot</dt>
                          <dd>
                            {replay?.spaceWeather
                              ? "Present"
                              : "Not yet received"}
                          </dd>
                        </dl>
                        <p>
                          Replay folds recorded events in sequence in this
                          inspector. The analysis scenario remains tied to its
                          archived state epoch.
                        </p>
                      </>
                    )}
                    <div className="flight-validation-links">
                      <h4>Engineering references</h4>
                      <a
                        href="https://celestrak.org/publications/AIAA/2006-6753/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Vallado SGP4 reference cases ↗
                      </a>
                      <a
                        href="https://github.com/nasa/CARA_Analysis_Tools"
                        target="_blank"
                        rel="noreferrer"
                      >
                        NASA CARA numerical reference cases ↗
                      </a>
                      <a
                        href="https://www.nasa.gov/cara/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Conjunction assessment guidance ↗
                      </a>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
          {busy && !analysis && (
            <div className="flight-loading">
              <span className="flight-spinner" />
              <h3>Propagating candidate trajectories</h3>
              <p>
                Integrating burns, refining closest approaches and screening
                nearby objects.
              </p>
            </div>
          )}
        </main>
      </div>
      <footer className="flight-replay">
        <button
          aria-label={
            playing ? "Pause scenario replay" : "Play scenario replay"
          }
          disabled={!analysis}
          onClick={() => {
            if (seconds >= scenario.config.encounterWindowSeconds)
              setSeconds(-timelineLead);
            setPlaying(!playing);
          }}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <button
          aria-label="Reset scenario replay"
          onClick={() => {
            setSeconds(-timelineLead);
            setPlaying(false);
          }}
        >
          ↺
        </button>
        <div className="flight-replay-clock">
          <span>SCENARIO CLOCK</span>
          <strong>{utc(scenario.epoch, seconds)}</strong>
        </div>
        <div className="flight-replay-track">
          <div>
            <span>BURN −{+(timelineLead / 60).toFixed(1)} MIN</span>
            <span>
              TCA WINDOW +{scenario.config.encounterWindowSeconds / 60} MIN
            </span>
          </div>
          <input
            aria-label="Scenario replay time"
            type="range"
            min={-timelineLead}
            max={scenario.config.encounterWindowSeconds}
            step=".1"
            value={seconds}
            onChange={(e) => {
              setSeconds(Number(e.target.value));
              setPlaying(false);
            }}
            style={{
              background: `linear-gradient(to right,var(--m-mint) ${progress}%,#28323d ${progress}%)`,
            }}
          />
        </div>
        <select
          aria-label="Replay speed"
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
        >
          {[1, 10, 60, 300].map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
        <span className="flight-offline-label">OFFLINE REPLAY READY</span>
      </footer>
    </section>
  );
}
function Metric({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className={`flight-metric ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
