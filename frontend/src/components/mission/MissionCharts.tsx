import { useRef, useState } from "react";
import { dot, sub } from "../../mission/math";
import { encounterPlane } from "../../mission/encounter";
import type {
  EncounterResult,
  ManeuverResult,
  MissionScenario,
  Vec3,
} from "../../mission/types";

export function EncounterPlot({
  encounter,
  candidate,
  scenario,
}: {
  encounter: EncounterResult;
  candidate: ManeuverResult;
  scenario: MissionScenario;
}) {
  const [x, y] = encounterPlane(
    sub(scenario.secondary.state.v, scenario.primary.state.v),
  );
  const relative = sub(candidate.secondaryAtTca.r, candidate.primaryAtTca.r);
  const candidateMean = [dot(relative, x), dot(relative, y)];
  const e = encounter.ellipse;
  const extent = Math.max(
    300,
    Math.abs(encounter.mean[0]) + 3 * e.major,
    Math.abs(encounter.mean[1]) + 3 * e.major,
  );
  const zoom = 210 / extent,
    cx = 350,
    cy = 235;
  const markerX = cx + candidateMean[0] * zoom,
    markerY = cy - candidateMean[1] * zoom;
  const inBounds =
    markerX > 30 && markerX < 670 && markerY > 25 && markerY < 445;
  return (
    <svg
      className="flight-encounter-svg"
      viewBox="0 0 700 470"
      role="img"
      aria-label="Encounter plane with baseline uncertainty ellipses and candidate miss geometry"
    >
      <defs>
        <pattern
          id="flight-grid"
          width="35"
          height="35"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 35 0 L 0 0 0 35"
            fill="none"
            stroke="#8cb4cf"
            strokeOpacity=".08"
          />
        </pattern>
        <radialGradient id="flight-glow">
          <stop stopColor="#f4aa63" stopOpacity=".13" />
          <stop offset="1" stopColor="#f4aa63" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="700" height="470" fill="url(#flight-grid)" />
      <circle cx={cx} cy={cy} r="215" fill="url(#flight-glow)" />
      <path
        d={`M 25 ${cy} H 675 M ${cx} 20 V 450`}
        stroke="#658091"
        strokeWidth=".8"
        strokeDasharray="3 5"
      />
      {[3, 2, 1].map((sigma) => (
        <ellipse
          key={sigma}
          cx={cx + encounter.mean[0] * zoom}
          cy={cy - encounter.mean[1] * zoom}
          rx={sigma * e.major * zoom}
          ry={sigma * e.minor * zoom}
          transform={`rotate(${(-e.angle * 180) / Math.PI} ${cx + encounter.mean[0] * zoom} ${cy - encounter.mean[1] * zoom})`}
          fill={sigma === 1 ? "#e7a367" : "none"}
          fillOpacity=".08"
          stroke="#e7a367"
          strokeOpacity={sigma === 3 ? 0.25 : sigma === 2 ? 0.45 : 0.9}
          strokeWidth="1.2"
        />
      ))}
      <line
        x1={cx}
        y1={cy}
        x2={cx + encounter.mean[0] * zoom}
        y2={cy - encounter.mean[1] * zoom}
        stroke="#e7a367"
        strokeDasharray="5 5"
      />
      <circle
        cx={cx}
        cy={cy}
        r={Math.max(2, encounter.hardBodyRadiusM * zoom)}
        fill="#e9f0f3"
      />
      <circle
        cx={cx + encounter.mean[0] * zoom}
        cy={cy - encounter.mean[1] * zoom}
        r="4"
        fill="#ffb16c"
      />
      <text x={cx + 10} y={cy + 20} fill="#dce5e9" fontSize="10">
        PRIMARY / COMBINED HARD BODY
      </text>
      <text x="24" y="28" fill="#8498a7" fontSize="10" letterSpacing="2">
        B-PLANE · BASELINE 1σ / 2σ / 3σ
      </text>
      <text x="24" y="449" fill="#8498a7" fontSize="10">
        GRID {(35 / zoom).toFixed(0)} m · normal to relative velocity
      </text>
      {candidate.id !== "coast" &&
        (inBounds ? (
          <g>
            <circle
              cx={markerX}
              cy={markerY}
              r="7"
              fill="none"
              stroke="#7ae1c1"
              strokeWidth="2"
            />
            <path
              d={`M ${markerX - 12} ${markerY} h 24 M ${markerX} ${markerY - 12} v 24`}
              stroke="#7ae1c1"
            />
            <text
              x={markerX + 15}
              y={markerY - 12}
              fill="#7ae1c1"
              fontSize="11"
            >
              CANDIDATE
            </text>
          </g>
        ) : (
          <text x="675" y="449" textAnchor="end" fill="#7ae1c1" fontSize="11">
            CANDIDATE OUTSIDE BASELINE VIEW ↗
          </text>
        ))}
    </svg>
  );
}
export function SeparationPlot({
  candidate,
  seconds,
}: {
  candidate: ManeuverResult;
  seconds: number;
}) {
  const samples = candidate.samples,
    first = samples[0].seconds,
    last = samples[samples.length - 1].seconds;
  const x = (t: number) => 55 + ((t - first) / (last - first)) * 625;
  const max = Math.max(
    3,
    ...samples.map((s) => Math.log10(Math.max(1, s.separationM))),
  );
  const y = (d: number) => 185 - (Math.log10(Math.max(1, d)) / max) * 155;
  return (
    <svg
      viewBox="0 0 700 225"
      role="img"
      aria-label="Separation versus time; logarithmic distance axis"
      className="flight-separation-svg"
    >
      {[0, 1, 2, 3, 4, 5, 6, 7, 8]
        .filter((i) => i <= max)
        .map((i) => (
          <g key={i}>
            <line
              x1="55"
              x2="680"
              y1={y(10 ** i)}
              y2={y(10 ** i)}
              stroke="#ffffff0d"
            />
            <text
              x="45"
              y={y(10 ** i) + 3}
              textAnchor="end"
              fill="#8296a4"
              fontSize="9"
            >
              {i < 3 ? `${10 ** i}m` : `${10 ** (i - 3)}km`}
            </text>
          </g>
        ))}
      <path
        d={samples
          .map(
            (s, i) =>
              `${i ? "L" : "M"}${x(s.seconds).toFixed(2)},${y(s.separationM).toFixed(2)}`,
          )
          .join(" ")}
        fill="none"
        stroke="#7ae1c1"
        strokeWidth="2"
      />
      <line
        x1={x(seconds)}
        x2={x(seconds)}
        y1="20"
        y2="190"
        stroke="#ffb16c"
        strokeDasharray="4 4"
      />
      <line x1={x(0)} x2={x(0)} y1="20" y2="190" stroke="#ffffff55" />
      <text x="55" y="210" fill="#8296a4" fontSize="10">
        BURN −{(-first / 60).toFixed(0)} MIN
      </text>
      <text x={x(0) - 5} y="210" textAnchor="end" fill="#8296a4" fontSize="10">
        EPOCH
      </text>
      <text x="680" y="210" textAnchor="end" fill="#8296a4" fontSize="10">
        +{last / 60} MIN
      </text>
    </svg>
  );
}

/** Orthographic view of the computed inertial trajectories. Playback positions are
 * linearly interpolated between exported samples, used for visualization only. */
export function OrbitReplay({
  candidate,
  seconds,
}: {
  candidate: ManeuverResult;
  seconds: number;
}) {
  const [view, setView] = useState({ tilt: 0.52, spin: 0.7 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const { tilt, spin } = view;
  const earth = 6378137,
    zoom = 138 / earth;
  const project = (p: Vec3) => {
    const x = p[0] * Math.cos(spin) - p[1] * Math.sin(spin),
      y = p[0] * Math.sin(spin) + p[1] * Math.cos(spin);
    return {
      x: 350 + x * zoom,
      y: 185 - (p[2] * Math.cos(tilt) - y * Math.sin(tilt)) * zoom,
      depth: p[2] * Math.sin(tilt) + y * Math.cos(tilt),
    };
  };
  const path = (points: Vec3[]) =>
    points
      .map((p, i) => {
        const q = project(p);
        return `${i ? "L" : "M"}${q.x.toFixed(2)},${q.y.toFixed(2)}`;
      })
      .join(" ");
  const samples = candidate.samples,
    idx = samples.findIndex((s) => s.seconds >= seconds);
  const b = samples[idx < 0 ? samples.length - 1 : idx],
    a = samples[Math.max(0, (idx < 0 ? samples.length - 1 : idx) - 1)];
  const fraction =
    b.seconds === a.seconds
      ? 0
      : (seconds - a.seconds) / (b.seconds - a.seconds);
  const point = (key: "primary" | "secondary") =>
    project(a[key].map((v, i) => v + (b[key][i] - v) * fraction) as Vec3);
  const markers = [
    { key: "primary" as const, color: "#f4f0e8", label: "PRIMARY" },
    { key: "secondary" as const, color: "#edb382", label: "SECONDARY" },
  ];
  const marker = (m: (typeof markers)[number]) => {
    const p = point(m.key);
    return (
      <g key={m.key}>
        <circle cx={p.x} cy={p.y} r="9" fill={m.color} fillOpacity=".1" />
        <circle cx={p.x} cy={p.y} r="3.5" fill={m.color} />
        <text x={p.x + 12} y={p.y - 8} fill={m.color} fontSize="9">
          {m.label}
        </text>
      </g>
    );
  };
  return (
    <svg
      viewBox="0 0 700 370"
      role="img"
      aria-label="Orbital replay of computed primary and secondary trajectories; drag to rotate"
      className="flight-orbit-svg"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.x,
          dy = e.clientY - drag.current.y;
        drag.current = { x: e.clientX, y: e.clientY };
        setView((v) => ({
          spin: v.spin - dx * 0.008,
          tilt: Math.max(-1.5, Math.min(1.5, v.tilt + dy * 0.008)),
        }));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <defs>
        <radialGradient id="flight-earth" cx="30%" cy="25%" r="80%">
          <stop stopColor="#304653" />
          <stop offset=".5" stopColor="#162734" />
          <stop offset="1" stopColor="#0b131d" />
        </radialGradient>
      </defs>
      <text x="24" y="25" fill="#8498a7" fontSize="9" letterSpacing="1">
        INERTIAL ORBIT VIEW · VISUAL INTERPOLATION
      </text>
      <path
        d={path(samples.map((s) => s.primary))}
        fill="none"
        stroke="#f4f0e8"
        strokeOpacity=".18"
        strokeWidth="1.2"
      />
      <path
        d={path(samples.map((s) => s.secondary))}
        fill="none"
        stroke="#edb382"
        strokeOpacity=".25"
        strokeWidth="1.2"
      />
      {markers.filter((m) => point(m.key).depth < 0).map(marker)}
      <circle
        cx="350"
        cy="185"
        r="140"
        fill="none"
        stroke="#6cb4d6"
        strokeOpacity=".2"
      />
      <circle
        cx="350"
        cy="185"
        r="138"
        fill="url(#flight-earth)"
        stroke="#52798f"
        strokeOpacity=".4"
      />
      {[-60, -30, 0, 30, 60].map((lat) => {
        const rad = (lat * Math.PI) / 180;
        const points = Array.from({ length: 121 }, (_, i): Vec3 => {
          const lon = (i / 120) * 2 * Math.PI;
          return [
            earth * Math.cos(rad) * Math.cos(lon),
            earth * Math.cos(rad) * Math.sin(lon),
            earth * Math.sin(rad),
          ];
        });
        return (
          <path
            key={lat}
            d={points
              .map((p) => {
                const q = project(p);
                return `${q.depth >= 0 ? "L" : "M"}${q.x},${q.y}`;
              })
              .join(" ")
              .replace(/^L/, "M")}
            fill="none"
            stroke="#668596"
            strokeOpacity=".18"
          />
        );
      })}
      {(["primary", "secondary"] as const).map((key) => (
        <path
          key={key}
          d={samples
            .map((s) => {
              const p = project(s[key]);
              return `${p.depth >= 0 ? "L" : "M"}${p.x},${p.y}`;
            })
            .join(" ")
            .replace(/^L/, "M")}
          fill="none"
          stroke={key === "primary" ? "#f4f0e8" : "#edb382"}
          strokeOpacity=".7"
          strokeWidth="1.3"
        />
      ))}
      {candidate.deltaVMs > 0 &&
        (() => {
          const burn = project(samples[0].primary);
          return (
            <g>
              <path
                d={`M${burn.x - 6},${burn.y}h12M${burn.x},${burn.y - 6}v12`}
                stroke="#8cdec3"
                strokeWidth="1.5"
                transform={`rotate(45 ${burn.x} ${burn.y})`}
              />
              <text
                x={burn.x + 10}
                y={burn.y + 14}
                fill="#8cdec3"
                fontSize="9"
                letterSpacing="1"
              >
                BURN
              </text>
            </g>
          );
        })()}
      {markers.filter((m) => point(m.key).depth >= 0).map(marker)}
      <text x="24" y="347" fill="#8498a7" fontSize="10">
        Earth radius 6,378 km · spacecraft markers enlarged
      </text>
      <text x="676" y="347" textAnchor="end" fill="#8cdec3" fontSize="10">
        {candidate.label}
      </text>
    </svg>
  );
}
