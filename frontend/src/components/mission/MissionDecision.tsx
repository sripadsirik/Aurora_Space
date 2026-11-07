import { useMemo, useState, type MouseEvent } from "react";
import type {
  ManeuverResult,
  MissionDecision,
  MissionScenario,
  TradeAxis,
  TradeSpace,
  Vec3,
} from "../../mission/types";
import { TRADE_AXES } from "../../mission/tradeSpace";
import { downloadText } from "../../utils/download";
import { distance, leadLabel, pcLabel } from "./format";

/** Categorical slots validated against the card surface (#111923) for CVD. */
export const AXIS_COLORS: Record<TradeAxis, string> = {
  transverse: "#1fa57a",
  radial: "#d9772f",
  normal: "#6f73e6",
};
export const AXIS_LABELS: Record<TradeAxis, string> = {
  transverse: "Along-track",
  radial: "Radial",
  normal: "Normal",
};
const AXIS_INDEX: Record<TradeAxis, number> = {
  radial: 0,
  transverse: 1,
  normal: 2,
};
export interface DesignRequest {
  deltaVRtn: Vec3;
  burnLeadSeconds: number;
}

export function DecisionBanner({
  decision,
  candidates,
  selected,
  onReview,
}: {
  decision: MissionDecision;
  candidates: ManeuverResult[];
  selected: string;
  onReview: (id: string) => void;
}) {
  const recommended = candidates.find((c) => c.id === decision.recommendedId);
  const tone =
    decision.status === "maneuver"
      ? "go"
      : decision.status === "monitor"
        ? "calm"
        : "hold";
  return (
    <section
      className={`flight-decision ${tone}`}
      aria-label="Analysis recommendation"
    >
      <div className="flight-decision-status">
        <span className="flight-decision-icon" aria-hidden>
          {tone === "go" ? "▲" : tone === "calm" ? "●" : "■"}
        </span>
        <div>
          <small>
            {decision.status === "maneuver"
              ? "MANEUVER RECOMMENDED FOR REVIEW"
              : decision.status === "monitor"
                ? "BELOW ACTION THRESHOLD"
                : decision.status === "no-feasible"
                  ? "NO QUALIFYING CANDIDATE"
                  : "INSUFFICIENT DATA"}
          </small>
          <strong>{decision.headline}</strong>
        </div>
      </div>
      {recommended && (
        <div className="flight-decision-metrics">
          <div>
            <small>PROJECTED MISS</small>
            <strong>{distance(recommended.missDistanceM)}</strong>
          </div>
          <div>
            <small>IDEAL PROPELLANT</small>
            <strong>
              {(recommended.fuelKg * 1000).toFixed(2)} <span>g</span>
            </strong>
          </div>
        </div>
      )}
      <div className="flight-decision-actions">
        <span>
          ACTION {decision.pcActionThreshold.toExponential(0)} · GOAL{" "}
          {decision.pcGoal.toExponential(0)}
        </span>
        {recommended && (
          <button
            className="flight-primary-button"
            onClick={() => onReview(recommended.id)}
            disabled={selected === recommended.id}
          >
            {selected === recommended.id
              ? "Recommendation selected"
              : "Review recommendation →"}
          </button>
        )}
      </div>
      <details className="flight-decision-reasoning">
        <summary>
          Why this result <span>Assumptions & decision criteria</span>
        </summary>
        <ul>
          {decision.rationale.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

const HEAT = { left: 70, right: 704, top: 18, bottom: 318 };
/** Single-hue sequential ramp for dark surfaces: low values recede into the card. */
const RAMP = [
  [20, 29, 39],
  [52, 38, 36],
  [118, 63, 36],
  [205, 118, 56],
  [255, 214, 168],
];
function ramp(t: number) {
  const k = Math.min(1, Math.max(0, t)) * (RAMP.length - 1),
    i = Math.min(RAMP.length - 2, Math.floor(k)),
    f = k - i;
  return `rgb(${RAMP[i].map((v, j) => Math.round(v + (RAMP[i + 1][j] - v) * f)).join(",")})`;
}
const PC_FLOOR = -20,
  PC_CEILING = -2;

export function TradeSpacePanel({
  trade,
  scenario,
  candidates,
  selected,
  recommendedId,
  onDesign,
  onSelect,
}: {
  trade: TradeSpace;
  scenario: MissionScenario;
  candidates: ManeuverResult[];
  selected: string;
  recommendedId: string | null;
  onDesign: (request: DesignRequest) => void;
  onSelect: (id: string) => void;
}) {
  const [axis, setAxis] = useState<TradeAxis>("transverse");
  const [metric, setMetric] = useState<"pc" | "miss">(
    trade.axes[0].pc ? "pc" : "miss",
  );
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const data = trade.axes.find((a) => a.axis === axis)!;
  const rows = trade.leadsSeconds.length,
    cols = trade.deltaVMs.length;
  const maxDv = trade.deltaVMs[cols - 1];
  const cellW = (HEAT.right - HEAT.left) / cols,
    cellH = (HEAT.bottom - HEAT.top) / rows;
  // Earliest burn at the top; time runs downward toward closest approach.
  const rowY = (row: number) => HEAT.top + (rows - 1 - row) * cellH;
  const leadY = (lead: number) => {
    const first = trade.leadsSeconds[0],
      last = trade.leadsSeconds[rows - 1];
    return (
      HEAT.top +
      cellH / 2 +
      ((last - lead) / (last - first)) * (rows - 1) * cellH
    );
  };
  const dvX = (dv: number) =>
    HEAT.left + cellW / 2 + ((dv + maxDv) / (2 * maxDv)) * (cols - 1) * cellW;
  const usePc = metric === "pc" && data.pc !== null;
  const missRange = useMemo(() => {
    const all = data.missM.flat().map((m) => Math.log10(Math.max(1, m)));
    return [Math.min(...all), Math.max(...all)];
  }, [data]);
  const intensity = (row: number, col: number) => {
    if (usePc) {
      const p = data.pc![row][col];
      return p <= 0 ? 0 : (Math.log10(p) - PC_FLOOR) / (PC_CEILING - PC_FLOOR);
    }
    const m = Math.log10(Math.max(1, data.missM[row][col]));
    return (missRange[1] - m) / (missRange[1] - missRange[0] || 1);
  };
  const passes = (row: number, col: number) =>
    data.pc !== null && data.pc[row][col] <= trade.pcGoal;
  const contour = useMemo(() => {
    if (!data.pc) return "";
    const segments: string[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const here = passes(r, c),
          x = HEAT.left + c * cellW,
          y = rowY(r);
        if (c + 1 < cols && here !== passes(r, c + 1))
          segments.push(`M${x + cellW},${y}v${cellH}`);
        if (r + 1 < rows && here !== passes(r + 1, c))
          segments.push(`M${x},${y}h${cellW}`);
      }
    return segments.join("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, trade.pcGoal]);
  const onAxis = candidates.filter((c) =>
    c.deltaVRtn.every((v, i) => i === AXIS_INDEX[axis] || v === 0),
  );
  const locate = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 720,
      y = ((e.clientY - box.top) / box.height) * 360;
    const col = Math.floor((x - HEAT.left) / cellW),
      row = rows - 1 - Math.floor((y - HEAT.top) / cellH);
    return col >= 0 && col < cols && row >= 0 && row < rows
      ? { row, col }
      : null;
  };
  const design = (row: number, col: number) => {
    const v: Vec3 = [0, 0, 0];
    v[AXIS_INDEX[axis]] = trade.deltaVMs[col];
    if (v.every((value) => value === 0)) onSelect("coast");
    else onDesign({ deltaVRtn: v, burnLeadSeconds: trade.leadsSeconds[row] });
  };
  const readout = hover ?? {
    row: trade.leadsSeconds.reduce(
      (best, lead, i) =>
        Math.abs(lead - scenario.config.burnLeadSeconds) <
        Math.abs(trade.leadsSeconds[best] - scenario.config.burnLeadSeconds)
          ? i
          : best,
      0,
    ),
    col: (cols - 1) / 2,
  };
  const exportCsv = () => {
    const lines = ["axis,burn_lead_s,delta_v_ms,miss_m,pc_linearized"];
    for (const a of trade.axes)
      trade.leadsSeconds.forEach((lead, r) =>
        trade.deltaVMs.forEach((dv, c) =>
          lines.push(
            `${a.axis},${lead},${dv},${a.missM[r][c]},${a.pc ? a.pc[r][c] : ""}`,
          ),
        ),
      );
    downloadText(
      `aurora-trade-space-${scenario.id.replace(/[^\w-]/g, "_")}.csv`,
      lines.join("\n"),
      "text/csv",
    );
  };
  const check = trade.validation;
  return (
    <section className="flight-card flight-tradespace">
      <div className="flight-card-heading">
        <h3>Maneuver trade space</h3>
        <span>
          {rows} BURN TIMES × {cols} Δv × 3 AXES ·{" "}
          {(rows * cols * 3).toLocaleString()} ENCOUNTERS
        </span>
      </div>
      <div className="flight-tradespace-body">
        <div className="flight-heatmap">
          <div className="flight-segmented-row">
            <div
              className="flight-segmented"
              role="group"
              aria-label="Impulse axis"
            >
              {TRADE_AXES.map((a) => (
                <button
                  key={a}
                  aria-pressed={axis === a}
                  onClick={() => setAxis(a)}
                >
                  <i style={{ background: AXIS_COLORS[a] }} />
                  {AXIS_LABELS[a]}
                </button>
              ))}
            </div>
            <div
              className="flight-segmented"
              role="group"
              aria-label="Heatmap metric"
            >
              <button
                aria-pressed={usePc}
                disabled={!data.pc}
                title={data.pc ? undefined : trade.pcReason}
                onClick={() => setMetric("pc")}
              >
                Pc
              </button>
              <button aria-pressed={!usePc} onClick={() => setMetric("miss")}>
                Miss distance
              </button>
            </div>
          </div>
          <svg
            viewBox="0 0 720 360"
            className="flight-heatmap-svg"
            role="img"
            aria-label={`${AXIS_LABELS[axis]} trade space: ${usePc ? "collision probability" : "miss distance"} by burn time and Δv. Click a cell to verify it with full RK4.`}
            onPointerMove={(e) => setHover(locate(e))}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              const cell = locate(e);
              if (cell) design(cell.row, cell.col);
            }}
          >
            {trade.leadsSeconds.map((_, r) =>
              trade.deltaVMs.map((__, c) => (
                <rect
                  key={`${r}-${c}`}
                  x={HEAT.left + c * cellW}
                  y={rowY(r)}
                  width={cellW + 0.4}
                  height={cellH + 0.4}
                  fill={ramp(intensity(r, c))}
                />
              )),
            )}
            {usePc && (
              <path
                d={contour}
                stroke="#8cdec3"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            )}
            <line
              x1={dvX(0)}
              x2={dvX(0)}
              y1={HEAT.top}
              y2={HEAT.bottom}
              stroke="#ffffff30"
              strokeDasharray="2 4"
            />
            <line
              x1={HEAT.left}
              x2={HEAT.right}
              y1={leadY(scenario.config.burnLeadSeconds)}
              y2={leadY(scenario.config.burnLeadSeconds)}
              stroke="#ffffff40"
              strokeDasharray="2 4"
            />
            <text
              x={HEAT.left + 18}
              y={leadY(scenario.config.burnLeadSeconds) - 9}
              className="flight-svg-halo"
              fill="#c4d1da"
              fontSize="9"
              letterSpacing="1"
            >
              PLANNED BURN TIME
            </text>
            {onAxis.map((c) => {
              const dv = c.deltaVRtn[AXIS_INDEX[axis]];
              if (c.burnLeadSeconds < trade.leadsSeconds[0]) return null;
              const x = dvX(dv),
                y = leadY(c.burnLeadSeconds),
                active = c.id === selected,
                rec = c.id === recommendedId;
              return (
                <g
                  key={c.id}
                  className="flight-heat-marker"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(c.id);
                  }}
                >
                  <title>{`${c.label} · full RK4 · Pc ${pcLabel(c.computedPc)} · miss ${distance(c.missDistanceM)}`}</title>
                  <circle cx={x} cy={y} r="11" fill="transparent" />
                  <circle
                    cx={x}
                    cy={y}
                    r={active ? 6 : 4.5}
                    fill={active ? "#f4f0e8" : "#0c1118"}
                    stroke="#f4f0e8"
                    strokeWidth="2"
                  />
                  {rec && (
                    <>
                      <circle
                        cx={x}
                        cy={y}
                        r="10"
                        fill="none"
                        stroke="#8cdec3"
                        strokeWidth="2"
                      />
                      <text
                        x={x}
                        y={y - 15}
                        textAnchor="middle"
                        fill="#8cdec3"
                        fontSize="9"
                        fontWeight="600"
                        letterSpacing="1"
                        className="flight-svg-halo"
                      >
                        RECOMMENDED
                      </text>
                    </>
                  )}
                </g>
              );
            })}
            {hover && (
              <rect
                x={HEAT.left + hover.col * cellW}
                y={rowY(hover.row)}
                width={cellW}
                height={cellH}
                fill="none"
                stroke="#f4f0e8"
                strokeWidth="1.5"
                pointerEvents="none"
              />
            )}
            {[0, 30, 60, 90, 120]
              .map((m) => m * 60)
              .filter(
                (s) =>
                  s >= trade.leadsSeconds[0] &&
                  s <= trade.leadsSeconds[rows - 1],
              )
              .map((s) => (
                <text
                  key={s}
                  x={HEAT.left - 8}
                  y={leadY(s) + 3}
                  textAnchor="end"
                  fill="#8296a4"
                  fontSize="9"
                >
                  {leadLabel(s)}
                </text>
              ))}
            {[-1, -0.5, 0, 0.5, 1].map((f) => (
              <text
                key={f}
                x={dvX(f * maxDv)}
                y={HEAT.bottom + 16}
                textAnchor="middle"
                fill="#8296a4"
                fontSize="9"
              >
                {f === 0
                  ? "0"
                  : `${f > 0 ? "+" : "−"}${(Math.abs(f) * maxDv).toPrecision(2)}`}
              </text>
            ))}
            <text
              x={(HEAT.left + HEAT.right) / 2}
              y={HEAT.bottom + 34}
              textAnchor="middle"
              fill="#8296a4"
              fontSize="9"
              letterSpacing="1"
            >
              {AXIS_LABELS[axis].toUpperCase()} Δv · m/s
            </text>
          </svg>
          <div className="flight-heat-legend">
            <span>
              {usePc ? "Pc ≤ 1e−20" : `${distance(10 ** missRange[1])}`}
            </span>
            <i
              style={{
                background: `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map(ramp).join(",")})`,
              }}
            />
            <span>
              {usePc ? "Pc ≥ 1e−2" : `${distance(10 ** missRange[0])}`}
            </span>
            {usePc && (
              <span className="flight-heat-goal">
                <b /> Pc goal {trade.pcGoal.toExponential(0)} boundary
              </span>
            )}
            <span className="flight-heat-goal">
              <b className="dot" /> Full RK4 candidate
            </span>
          </div>
          <p className="flight-heat-readout" aria-live="polite">
            <strong>
              {leadLabel(trade.leadsSeconds[readout.row])} · {AXIS_LABELS[axis]}{" "}
              {trade.deltaVMs[readout.col] > 0 ? "+" : ""}
              {trade.deltaVMs[readout.col].toFixed(3)} m/s
            </strong>
            <span>
              Pc{" "}
              {data.pc
                ? pcLabel(data.pc[readout.row][readout.col])
                : "unavailable"}{" "}
              · miss {distance(data.missM[readout.row][readout.col])} ·
              linearized
            </span>
            <em>
              {hover
                ? "Click to verify with full RK4 →"
                : "Hover the map · click any cell to simulate it"}
            </em>
          </p>
        </div>
        <div className="flight-tradespace-side">
          <MinimumDeltaVChart
            trade={trade}
            axis={axis}
            plannedLead={scenario.config.burnLeadSeconds}
            onAxis={setAxis}
          />
          <div
            className={`flight-validation-badge ${check.maxRelativeError < 0.02 ? "ok" : "warn"}`}
          >
            <strong>
              {check.maxRelativeError < 0.02
                ? "✓ Miss-distance check passed"
                : "! Linear approximation diverges"}
            </strong>
            <span>
              Miss distance agrees with {check.candidates} full RK4 trajectories
              within {distance(check.maxMissErrorM)} (
              {(check.maxRelativeError * 100).toFixed(2)}%). Map probabilities
              are approximate; verify your candidate with the full model.
            </span>
          </div>
          <p className="flight-tradespace-note">
            {trade.pcReason}. Each map is {rows * cols} encounters; click any
            cell to promote it to a full nonlinear simulation.
            <button onClick={exportCsv}>Download trade space CSV</button>
          </p>
        </div>
      </div>
    </section>
  );
}

function MinimumDeltaVChart({
  trade,
  axis,
  plannedLead,
  onAxis,
}: {
  trade: TradeSpace;
  axis: TradeAxis;
  plannedLead: number;
  onAxis: (axis: TradeAxis) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const L = { left: 46, right: 330, top: 16, bottom: 186 };
  const leads = trade.leadsSeconds,
    maxDv = trade.deltaVMs[trade.deltaVMs.length - 1];
  const x = (lead: number) =>
    L.left + (lead / leads[leads.length - 1]) * (L.right - L.left);
  // Log axis: the required Δv spans orders of magnitude across burn times.
  const floor = maxDv / 100;
  const y = (dv: number) =>
    L.bottom -
    (Math.log10(Math.max(dv, floor) / floor) / 2) * (L.bottom - L.top);
  const series = trade.axes.map((a) => {
    let d = "",
      pen = false;
    a.minDeltaVForGoalMs.forEach((v, i) => {
      if (v === null) pen = false;
      else {
        d += `${pen ? "L" : "M"}${x(leads[i]).toFixed(1)},${y(Math.abs(v)).toFixed(1)}`;
        pen = true;
      }
    });
    return { ...a, d };
  });
  if (trade.axes.every((a) => a.minDeltaVForGoalMs.every((dv) => dv === 0)))
    return (
      <div className="flight-coast-result">
        <span>COAST MEETS THE GOAL</span>
        <strong>
          0 <small>m/s</small>
        </strong>
        <p>
          The baseline probability is already below the selected goal. No
          impulse is needed to meet that threshold.
        </p>
      </div>
    );
  if (!trade.axes[0].pc)
    return (
      <p className="flight-tradespace-note">
        Minimum-Δv curves need a burn execution uncertainty to evaluate Pc.
      </p>
    );
  const at = hover ?? null;
  return (
    <div className="flight-mindv">
      <h4>Δv needed to reach Pc goal</h4>
      <p>
        Linear estimate by burn time. Gaps mark times where no qualifying burn
        was found within budget.
      </p>
      <svg
        viewBox="0 0 340 222"
        role="img"
        aria-label="Minimum Δv to reach the Pc goal versus burn lead time, per impulse axis"
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * 340;
          const i = leads.reduce(
            (best, lead, k) =>
              Math.abs(x(lead) - px) < Math.abs(x(leads[best]) - px) ? k : best,
            0,
          );
          setHover(i);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {[0.01, 0.03, 0.1, 0.3, 1].map((f) => (
          <g key={f}>
            <line
              x1={L.left}
              x2={L.right}
              y1={y(f * maxDv)}
              y2={y(f * maxDv)}
              stroke="#ffffff0d"
            />
            <text
              x={L.left - 6}
              y={y(f * maxDv) + 3}
              textAnchor="end"
              fill="#8296a4"
              fontSize="9"
            >
              {+(f * maxDv).toPrecision(2)}
            </text>
          </g>
        ))}
        <text
          x={L.left - 6}
          y={L.top - 6}
          textAnchor="end"
          fill="#8296a4"
          fontSize="8"
        >
          m/s
        </text>
        {[0, 30, 60, 90, 120].map((m) => (
          <text
            key={m}
            x={x(m * 60)}
            y={L.bottom + 15}
            textAnchor="middle"
            fill="#8296a4"
            fontSize="9"
          >
            {m === 0 ? "TCA" : `−${m}m`}
          </text>
        ))}
        <line
          x1={x(plannedLead)}
          x2={x(plannedLead)}
          y1={L.top}
          y2={L.bottom}
          stroke="#ffffff40"
          strokeDasharray="2 4"
        />
        {series.map((s) => (
          <path
            key={s.axis}
            d={s.d}
            fill="none"
            stroke={AXIS_COLORS[s.axis]}
            strokeWidth={s.axis === axis ? 2.5 : 1.5}
            strokeOpacity={s.axis === axis ? 1 : 0.55}
            strokeLinejoin="round"
            onClick={() => onAxis(s.axis)}
            style={{ cursor: "pointer" }}
          />
        ))}
        {at !== null && (
          <>
            <line
              x1={x(leads[at])}
              x2={x(leads[at])}
              y1={L.top}
              y2={L.bottom}
              stroke="#f4f0e8"
              strokeOpacity=".5"
            />
            {series.map((s) => {
              const v = s.minDeltaVForGoalMs[at];
              return v === null ? null : (
                <circle
                  key={s.axis}
                  cx={x(leads[at])}
                  cy={y(Math.abs(v))}
                  r="4"
                  fill={AXIS_COLORS[s.axis]}
                  stroke="#111923"
                  strokeWidth="2"
                />
              );
            })}
          </>
        )}
        <text
          x={L.left}
          y={L.bottom + 32}
          fill="#8296a4"
          fontSize="9"
          letterSpacing="1"
        >
          BURN LEAD BEFORE CLOSEST APPROACH
        </text>
      </svg>
      <div className="flight-mindv-legend">
        {series.map((s) => {
          const v = at === null ? null : s.minDeltaVForGoalMs[at];
          return (
            <button
              key={s.axis}
              aria-pressed={s.axis === axis}
              onClick={() => onAxis(s.axis)}
            >
              <i style={{ background: AXIS_COLORS[s.axis] }} />
              {AXIS_LABELS[s.axis]}
              <span>
                {s.minDeltaVForGoalMs.every((x) => x === null)
                  ? "out of budget"
                  : at === null
                    ? ""
                    : v === null
                      ? "—"
                      : `${Math.abs(v).toFixed(3)} m/s`}
              </span>
            </button>
          );
        })}
        <small>{at === null ? "" : leadLabel(leads[at])}</small>
      </div>
    </div>
  );
}

export function ManeuverDesigner({
  scenario,
  draft,
  onSimulate,
  busy,
}: {
  scenario: MissionScenario;
  draft: DesignRequest | null;
  onSimulate: (request: DesignRequest) => void;
  busy: boolean;
}) {
  const [values, setValues] = useState({
    r: 0,
    t: 0.1,
    n: 0,
    leadMin: scenario.config.burnLeadSeconds / 60,
  });
  const [seen, setSeen] = useState<DesignRequest | null>(null);
  if (draft && draft !== seen) {
    setSeen(draft);
    setValues({
      r: draft.deltaVRtn[0],
      t: draft.deltaVRtn[1],
      n: draft.deltaVRtn[2],
      leadMin: draft.burnLeadSeconds / 60,
    });
  }
  const magnitude = Math.hypot(values.r, values.t, values.n);
  const lead = values.leadMin * 60;
  const problem = ![values.r, values.t, values.n, lead].every(Number.isFinite)
    ? "Enter finite impulse and timing values"
    : magnitude === 0
      ? "Enter a non-zero impulse"
      : magnitude > scenario.config.maxDeltaVMs + 1e-9
        ? `Exceeds ${scenario.config.maxDeltaVMs} m/s budget`
        : !(lead > scenario.config.encounterWindowSeconds && lead <= 7200)
          ? `Lead must be ${Math.ceil(scenario.config.encounterWindowSeconds / 60)}–120 min`
          : "";
  return (
    <section className="flight-card flight-settings flight-designer">
      <div className="flight-card-heading">
        <h3>Maneuver designer</h3>
        <span>FULL NONLINEAR RK4</span>
      </div>
      <div className="flight-settings-grid">
        {(
          [
            ["r", "Radial Δv · m/s"],
            ["t", "Along-track Δv · m/s"],
            ["n", "Normal Δv · m/s"],
            ["leadMin", "Burn lead · minutes"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              step="any"
              value={values[key]}
              onChange={(e) =>
                setValues({ ...values, [key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </div>
      <div className="flight-designer-foot">
        <span className={problem ? "amber-text" : ""}>
          {problem || `|Δv| ${magnitude.toFixed(4)} m/s`}
        </span>
        <button
          className="flight-primary-button"
          disabled={!!problem || busy}
          onClick={() =>
            onSimulate({
              deltaVRtn: [values.r, values.t, values.n],
              burnLeadSeconds: lead,
            })
          }
        >
          Simulate candidate ↗
        </button>
      </div>
    </section>
  );
}
