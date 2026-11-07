import { SatelliteInspector } from "./SatelliteInspector";
import { FeedSummary } from "../FeedSummary";
import { useMemo } from "react";
import type { ReactNode } from "react";

import { useUtcClock } from "../../hooks/useUtcClock";
import { env } from "../../utils/env";
import { useAuroraStore } from "../../store/auroraStore";
import type { Satellite, SourceDiagnostic } from "../../types/space";
import { isBzSouthward } from "../../utils/bzComponent";
import { getKpColor } from "../../utils/colors";
import {
  classifyConjunctionRisk,
  conjunctionRiskTextClass,
  missDistanceSeverityTextClass
} from "../../utils/conjunctionRisk";
import {
  formatCountdownToTca,
  formatMissDistance,
  formatProbability,
  formatProtonFlux,
  formatUtcTimestamp
} from "../../utils/format";
import { kpToBarHeight, kpToPercent } from "../../utils/kpScale";
import {
  formatKpIndex,
  formatMagneticFieldNt,
  formatSpeedKms
} from "../../utils/measurements";
import {
  earthRadiusMeters,
  getOrbitalPeriod,
  kpToAuroraBoundaryLatitude,
  kpToAuroraRadiusDegrees
} from "../../utils/orbit";
import { summarizeNoaaScales } from "../../utils/noaaScaleSummary";
import { normalizeProbability } from "../../utils/probability";
import { isElevatedSolarWind, solarWindSpeedArrow } from "../../utils/solarWind";
import {
  geomagneticStormScale,
  kpToGScaleInfo,
  protonFluxToSScaleInfo,
  radioBlackoutScale,
  rScaleColor,
  sScaleColor,
  solarRadiationStormScale,
  xrayClassToRScaleInfo
} from "../../utils/spaceWeatherScales";

interface PanelCardProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

const riskBadgeClass = (label: "LOW" | "MEDIUM" | "HIGH"): string => {
  if (label === "HIGH") {
    return "border-[#ff5a5a] bg-[#5c1515]/60 text-[#ff7f7f]";
  }

  if (label === "MEDIUM") {
    return "border-[#ffb454] bg-[#5f3a12]/60 text-[#ffc274]";
  }

  return "border-[#4ecf8f] bg-[#113d2a]/60 text-[#72e3ab]";
};

const getConjunctionAction = (probability: number): { label: string; className: string } => {
  const risk = classifyConjunctionRisk(probability);

  if (risk === "critical") {
    return {
      label: "PRIORITY REVIEW · SUPPLIED Pc",
      className: "border-[#ff4d4d] bg-[#591212]/60 text-[#ff7e7e]"
    };
  }

  if (risk === "warning") {
    return {
      label: "REVIEW · SUPPLIED Pc",
      className: "border-[#ff9f43] bg-[#5e3412]/60 text-[#ffbd72]"
    };
  }

  return {
    label: "LOWER SUPPLIED Pc · REVIEW DATA QUALITY",
    className: "border-[#3bd08c] bg-[#103b29]/60 text-[#7ce8b6]"
  };
};

const getStatusClass = (status: SourceDiagnostic["status"]): string => {
  if (status === "ERROR") return "text-[#ff7d7d]";
  if (status === "STALE") return "text-[#ffcd73]";
  return "text-[#7df0b2]";
};

const PanelCard = ({ title, closeLabel, onClose, children }: PanelCardProps): JSX.Element => (
  <section className="aurora-slide-panel pointer-events-auto flex min-h-[180px] w-full flex-col overflow-hidden">
    <header className="flex items-start justify-between border-b border-white/10 px-3 py-2">
      <h3 className="text-xs uppercase tracking-[0.17em] text-[var(--aurora-accent)]">{title}</h3>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="aurora-panel-close ml-3 h-6 w-6 text-base leading-none text-[#c2def3]"
      >
        x
      </button>
    </header>
    <div className="overflow-y-auto px-3 py-2 text-xs text-[#d8ebff]">{children}</div>
  </section>
);

const ConjunctionDetailPanel = (): JSX.Element | null => {
  const selectedConjunction = useAuroraStore((state) => state.selectedConjunction);
  const satellites = useAuroraStore((state) => state.satellites);
  const closePanel = useAuroraStore((state) => state.closePanel);
  useUtcClock();

  if (!selectedConjunction) {
    return null;
  }

  const satelliteByNorad = new Map<number, Satellite>(satellites.map((satellite) => [satellite.noradId, satellite]));
  const object1 = satelliteByNorad.get(selectedConjunction.object1.noradId);
  const object2 = satelliteByNorad.get(selectedConjunction.object2.noradId);

  const missDistanceClass = missDistanceSeverityTextClass(selectedConjunction.missDistanceM);
  const probabilityRisk = classifyConjunctionRisk(selectedConjunction.probability);
  const probabilityClass = conjunctionRiskTextClass(probabilityRisk, "text-[#7de6b1]");
  const gaugeValue = normalizeProbability(selectedConjunction.probability);
  const action = getConjunctionAction(selectedConjunction.probability);

  return (
    <PanelCard title="Conjunction Detail" closeLabel="Close conjunction details" onClose={() => closePanel("conjunction-detail")}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff2f2f]" />
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#ff7d7d]">CONJUNCTION WARNING</p>
        </div>

        <div className="space-y-1 border-t border-white/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">OBJECTS INVOLVED</p>
          <div className="rounded-sm border border-white/10 px-2 py-1">
            <p className="text-white">{selectedConjunction.object1.name}</p>
            <p className="text-[10px] text-[#9cc2de]">
              NORAD {selectedConjunction.object1.noradId} | {object1?.orbitType ?? "Unknown regime"}
            </p>
          </div>
          <p className="text-center text-[10px] text-[#7ca2bf]">vs</p>
          <div className="rounded-sm border border-white/10 px-2 py-1">
            <p className="text-white">{selectedConjunction.object2.name}</p>
            <p className="text-[10px] text-[#9cc2de]">
              NORAD {selectedConjunction.object2.noradId} | {object2?.orbitType ?? "Unknown regime"}
            </p>
          </div>
        </div>

        <div className="space-y-1 border-t border-white/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">CLOSE APPROACH DATA</p>
          <div className="grid grid-cols-[1.4fr_1fr] gap-y-1">
            <span>TCA (UTC)</span>
            <span className="text-right text-[11px]">{formatUtcTimestamp(selectedConjunction.tca)}</span>
            <span>Time until TCA</span>
            <span className="text-right">{formatCountdownToTca(selectedConjunction.tca)}</span>
            <span>Miss distance</span>
            <span className={`text-right ${missDistanceClass}`}>{formatMissDistance(selectedConjunction.missDistanceM)}</span>
            <span>Report issued (UTC)</span><span className="text-right">{selectedConjunction.createdAt ? new Date(selectedConjunction.createdAt).toUTCString() : "Sample report"}</span>
            <span>Relative velocity</span>
            <span className="text-right">{selectedConjunction.source ? "Not supplied by public CDM" : formatSpeedKms(selectedConjunction.relativeVelocityKms, 2)}</span>
            <span>Collision probability</span>
            <span className={`text-right ${probabilityClass}`}>{formatProbability(selectedConjunction.probability)}</span>
          </div>
        </div>

        <div className="space-y-2 border-t border-white/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">RISK ASSESSMENT</p>
          <div className="relative h-4 rounded-sm bg-gradient-to-r from-[#1f6a44] via-[#9a7e25] to-[#8d1f1f]">
            <div className="absolute left-[66.6%] top-0 h-full w-[1px] bg-[#ffb65f]" />
            <div className="absolute left-[88.8%] top-0 h-full w-[1px] bg-[#ff6262]" />
            <div
              className="absolute top-[-3px] h-[10px] w-[2px] bg-white"
              style={{ left: `calc(${Math.round(gaugeValue * 100)}% - 1px)` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#9cc2de]">
            <span>0</span>
            <span>ELEVATED &gt; 1/10000</span>
            <span>Pc &gt; 1/1000</span>
            <span>1</span>
          </div>
        </div>

        <div className={`inline-block rounded-sm border px-2 py-1 text-[10px] font-semibold ${action.className}`}>{action.label}</div>
      </div>
    </PanelCard>
  );
};

const SpaceWeatherPanel = (): JSX.Element => {
  const spaceWeather = useAuroraStore((state) => state.spaceWeather);
  const closePanel = useAuroraStore((state) => state.closePanel);
  const gLevel = kpToGScaleInfo(spaceWeather.kpIndex).code;
  const rInfo = xrayClassToRScaleInfo(spaceWeather.xrayFlux);
  const protonFlux = spaceWeather.protonFlux ?? 0;
  const sInfo = protonFluxToSScaleInfo(protonFlux);
  const noaa = summarizeNoaaScales(spaceWeather);
  const kpPosition = kpToPercent(spaceWeather.kpIndex);
  const auroraLatitude = kpToAuroraBoundaryLatitude(spaceWeather.kpIndex);
  const auroraRadiusDeg = kpToAuroraRadiusDegrees(spaceWeather.kpIndex);


  return (
    <PanelCard title="Space Weather" closeLabel="Close space weather panel" onClose={() => closePanel("space-weather")}>
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--aurora-accent)]">SPACE WEATHER | NOAA SWPC</p>
          <p className="text-[10px] text-[#9cc2de]">Last updated {formatUtcTimestamp(spaceWeather.lastUpdated)}</p>
          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
            <span className="text-[#9cc2de]">NOAA</span>
            {[noaa.geomagnetic, noaa.solarRadiation, noaa.radioBlackout].map((scale) => (
              <span
                key={scale.kind}
                className={`rounded-sm border px-1 py-0.5 font-semibold ${scale.kind === noaa.peak.kind && noaa.peak.code > 0 ? "" : "opacity-70"}`}
                style={{ borderColor: `${scale.color}55`, color: scale.color }}
                title={`${scale.level} · ${scale.label}`}
              >
                {scale.level}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
          <div className="rounded-sm border border-white/10 px-2 py-1">
            <p className="text-[10px] text-[#9cc2de]">Kp Index</p>
            <p className="text-lg font-semibold" style={{ color: getKpColor(spaceWeather.kpIndex) }}>
              {formatKpIndex(spaceWeather.kpIndex)}
            </p>
            <div className="relative mt-1 h-1.5 rounded bg-gradient-to-r from-[#6dff79] via-[#ffcb3b] to-[#ff2a2a]">
              <div className="absolute -top-1 h-3 w-[2px] bg-white" style={{ left: `calc(${kpPosition}% - 1px)` }} />
            </div>
          </div>
          <div className="rounded-sm border border-white/10 px-2 py-1">
            <p className="text-[10px] text-[#9cc2de]">Solar Wind Speed</p>
            <p className="text-lg">
              {spaceWeather.solarWindSpeed} km/s{" "}
              <span className={isElevatedSolarWind(spaceWeather.solarWindSpeed) ? "text-[#ffaf5e]" : "text-[#75e6ad]"}>
                {solarWindSpeedArrow(spaceWeather.solarWindSpeed)}
              </span>
            </p>
          </div>
          <div className="rounded-sm border border-white/10 px-2 py-1">
            <p className="text-[10px] text-[#9cc2de]">Bz Component</p>
            <p
              className={isBzSouthward(spaceWeather.bzComponent) ? "text-lg text-[#ff6f6f]" : "text-lg text-[#75e6ad]"}
              title="Negative Bz = Earth's magnetic shield weakened"
            >
              {formatMagneticFieldNt(spaceWeather.bzComponent)}
            </p>
          </div>
          <div className="rounded-sm border border-white/10 px-2 py-1">
            <p className="text-[10px] text-[#9cc2de]">X-ray Flux</p>
            <p className="text-lg">
              Class {spaceWeather.xrayFlux.charAt(0).toUpperCase()} ({spaceWeather.xrayFlux})
            </p>
            {rInfo.level !== "R0" && (
              <p className="text-[10px]" style={{ color: rScaleColor(rInfo.level) }}>
                Radio blackout {rInfo.level} · {rInfo.label}
              </p>
            )}
          </div>
          <div className="rounded-sm border border-white/10 px-2 py-1">
            <p className="text-[10px] text-[#9cc2de]">Proton Flux (&gt;=10 MeV)</p>
            <p className="text-lg" style={{ color: sScaleColor(sInfo.level) }}>
              {formatProtonFlux(protonFlux)}
            </p>
            {sInfo.level !== "S0" && (
              <p className="text-[10px]" style={{ color: sScaleColor(sInfo.level) }}>
                Radiation storm {sInfo.level} · {sInfo.label}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1 border-t border-white/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">STORM LEVELS (NOAA)</p>
          {geomagneticStormScale.map((row) => (
            <div
              key={row.level}
              className={`rounded-sm border px-2 py-1 ${gLevel === row.code ? "border-[#00d4ff]/60 bg-[#0f2b46]/50" : "border-white/10"}`}
            >
              <p className="text-[11px] text-white">
                {row.level} {gLevel === row.code ? "(CURRENT)" : ""}
              </p>
              <p className="text-[10px] text-[#9cc2de]">{row.impact}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-white/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">RADIO BLACKOUT LEVELS (NOAA)</p>
          {radioBlackoutScale.map((row) => (
            <div
              key={row.level}
              className={`rounded-sm border px-2 py-1 ${rInfo.code === row.code ? "border-[#00d4ff]/60 bg-[#0f2b46]/50" : "border-white/10"}`}
            >
              <p className="text-[11px] text-white">
                {row.level} {rInfo.code === row.code ? "(CURRENT)" : ""}
              </p>
              <p className="text-[10px] text-[#9cc2de]">{row.impact}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-white/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">SOLAR RADIATION STORM LEVELS (NOAA)</p>
          {solarRadiationStormScale.map((row) => (
            <div
              key={row.level}
              className={`rounded-sm border px-2 py-1 ${sInfo.code === row.code ? "border-[#00d4ff]/60 bg-[#0f2b46]/50" : "border-white/10"}`}
            >
              <p className="text-[11px] text-white">
                {row.level} {sInfo.code === row.code ? "(CURRENT)" : ""}
              </p>
              <p className="text-[10px] text-[#9cc2de]">{row.impact}</p>
            </div>
          ))}
        </div>

        <p className="engineering-note">Forecast not supplied by this feed. <a href="https://www.swpc.noaa.gov/products/3-day-forecast" target="_blank" rel="noreferrer">Open NOAA's forecast ↗</a></p>

        <div className="space-y-1 border-t border-white/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">AURORA OVAL ESTIMATE</p>
          <p className="text-[11px] text-white">Illustrative Kp-based boundary: above {auroraLatitude.toFixed(1)}N latitude</p>
          <svg viewBox="0 0 320 120" className="h-[120px] w-full rounded-sm border border-white/10 bg-[#081423]">
            <rect x="0" y="0" width="320" height="120" fill="#081423" />
            <line x1="0" y1="60" x2="320" y2="60" stroke="#20435d" strokeWidth="1" />
            <ellipse cx="160" cy="20" rx={Math.max(24, auroraRadiusDeg * 1.2)} ry="10" fill="#00ff96" fillOpacity="0.24" />
            <ellipse cx="160" cy="100" rx={Math.max(24, auroraRadiusDeg * 1.2)} ry="10" fill="#00ff96" fillOpacity="0.24" />
            <text x="8" y="14" fill="#9cc2de" fontSize="9">
              Aurora oval model
            </text>
          </svg>
        </div>
      </div>
    </PanelCard>
  );
};

const DataLayerStatusPanel = (): JSX.Element => {
  const closePanel = useAuroraStore((state) => state.closePanel);
  const isConnectedToBackend = useAuroraStore((state) => state.isConnectedToBackend);
  const sourceDiagnostics = useAuroraStore((state) => state.sourceDiagnostics);

  return (
    <PanelCard title="Data Sources" closeLabel="Close data source panel" onClose={() => closePanel("data-layers")}>
      <FeedSummary />
      <details className="source-diagnostics"><summary>Connection diagnostics</summary>
      <div className="space-y-2">
        {sourceDiagnostics.length === 0 ? (
          <div className="rounded-sm border border-white/10 px-2 py-2 text-[11px] text-[#9cc2de]">
            Waiting for backend diagnostics...
          </div>
        ) : (
          sourceDiagnostics.map((row) => (
            <div key={row.key} className="rounded-sm border border-white/10 px-2 py-1">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-white">{row.name}</p>
                <span className={`text-[10px] font-semibold ${getStatusClass(row.status)}`}>{row.status}</span>
              </div>
              <p className="text-[10px] text-[#6fb4df]">{row.url}</p>
              <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-[#9cc2de]">
                <span>Last event: {row.lastEvent}</span>
                <span className="text-right">Records: {row.records}</span>
                <span>Expected cadence: {row.frequency}</span>
                <span className="text-right">{row.key === "engine-rust" ? "Pipeline: positions" : "Pipeline: source"}</span>
              </div>
              {row.detail ? (
                <p className={`mt-1 text-[10px] ${row.status === "ERROR" ? "text-[#ff9a9a]" : "text-[#b6d4eb]"}`}>{row.detail}</p>
              ) : null}
            </div>
          ))
        )}

        <div className="rounded-sm border border-white/10 px-2 py-2">
          <p className="text-[10px] tracking-[0.12em] text-[var(--aurora-accent)]">BACKEND CONNECTION</p>
          {isConnectedToBackend ? (
            <p className="mt-1 text-[11px] text-[#7df0b2]">WebSocket connected</p>
          ) : !env.VITE_WS_URL ? (
            <p className="mt-1 text-[11px] text-[#ffcd73]">Backend not configured. Sample data is displayed.</p>
          ) : (
            <div className="mt-1 flex items-center gap-2 text-[11px] text-[#ffcd73]">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#ffcd73] border-t-transparent" />
              <span>Connecting to backend...</span>
            </div>
          )}
        </div>
      </div>
      </details>
    </PanelCard>
  );
};

export const PanelManager = (): JSX.Element => {
  const activePanels = useAuroraStore((state) => state.activePanels);

  const panelKeys = useMemo(
    () =>
      [
        activePanels.has("satellite-detail") ? "satellite-detail" : null,
        activePanels.has("conjunction-detail") ? "conjunction-detail" : null,
        activePanels.has("space-weather") ? "space-weather" : null,
        activePanels.has("data-layers") ? "data-layers" : null
      ].filter((value): value is string => Boolean(value)),
    [activePanels]
  );

  if (panelKeys.length === 0) {
    return <div className="aurora-panel-stack pointer-events-none" />;
  }

  return (
    <div className="aurora-panel-stack pointer-events-none">
      {panelKeys.map((panelKey) => {
        if (panelKey === "satellite-detail") {
          return <SatelliteInspector key={panelKey} />;
        }
        if (panelKey === "conjunction-detail") {
          return <ConjunctionDetailPanel key={panelKey} />;
        }
        if (panelKey === "space-weather") {
          return <SpaceWeatherPanel key={panelKey} />;
        }
        return <DataLayerStatusPanel key={panelKey} />;
      })}
    </div>
  );
};
