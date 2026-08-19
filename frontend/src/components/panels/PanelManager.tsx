import { useMemo } from "react";
import type { ReactNode } from "react";

import { useUtcClock } from "../../hooks/useUtcClock";
import { useAuroraStore } from "../../store/auroraStore";
import type { Satellite, SourceDiagnostic } from "../../types/space";
import { getKpColor } from "../../utils/colors";
import { conjunctionPeerName } from "../../utils/conjunctionLabels";
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
  formatUtcTime
} from "../../utils/format";
import { kpToBarHeight, kpToPercent } from "../../utils/kpScale";
import {
  earthRadiusMeters,
  getOrbitalPeriod,
  kpToAuroraBoundaryLatitude,
  kpToAuroraRadiusDegrees
} from "../../utils/orbit";
import { normalizeProbability } from "../../utils/probability";
import { getSpaceWeatherImpact } from "../../utils/satelliteImpact";
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

const ORBIT_LABELS: Record<Satellite["orbitType"], string> = {
  LEO: "160-2,000 km",
  MEO: "2,000-35,786 km",
  GEO: "~35,786 km"
};

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
      label: "MANEUVER RECOMMENDED",
      className: "border-[#ff4d4d] bg-[#591212]/60 text-[#ff7e7e]"
    };
  }

  if (risk === "warning") {
    return {
      label: "MONITORING REQUIRED",
      className: "border-[#ff9f43] bg-[#5e3412]/60 text-[#ffbd72]"
    };
  }

  return {
    label: "NO ACTION REQUIRED",
    className: "border-[#3bd08c] bg-[#103b29]/60 text-[#7ce8b6]"
  };
};

const getStatusClass = (status: SourceDiagnostic["status"]): string => {
  if (status === "ERROR") return "text-[#ff7d7d]";
  if (status === "STALE") return "text-[#ffcd73]";
  return "text-[#7df0b2]";
};

const getOrbitPeriodMinutes = (altitudeKm: number): number =>
  getOrbitalPeriod(earthRadiusMeters + altitudeKm * 1000) / 60;

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

const SatelliteDetailPanel = (): JSX.Element | null => {
  const now = useUtcClock();
  const selectedSatellite = useAuroraStore((state) => state.selectedSatellite);
  const conjunctions = useAuroraStore((state) => state.conjunctions);
  const spaceWeather = useAuroraStore((state) => state.spaceWeather);
  const closePanel = useAuroraStore((state) => state.closePanel);

  if (!selectedSatellite) {
    return null;
  }

  const relatedConjunctions = conjunctions.filter(
    (conjunction) =>
      conjunction.object1.noradId === selectedSatellite.noradId || conjunction.object2.noradId === selectedSatellite.noradId
  );

  const impact = getSpaceWeatherImpact(selectedSatellite, spaceWeather.kpIndex);
  const periodMinutes = getOrbitPeriodMinutes(selectedSatellite.altitudeKm);

  return (
    <PanelCard title="Satellite Detail" closeLabel="Close satellite details" onClose={() => closePanel("satellite-detail")}>
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">{selectedSatellite.name}</p>
          <p className="text-[11px] text-[#9cc2de]">NORAD {selectedSatellite.noradId}</p>
          <div className="mt-1 flex gap-2">
            <span className="rounded-sm border border-white/20 px-2 py-0.5 text-[10px]">{selectedSatellite.owner}</span>
            <span className="rounded-sm border border-white/20 px-2 py-0.5 text-[10px] uppercase">
              {selectedSatellite.riskLevel}
            </span>
          </div>
        </div>

        <div className="space-y-1 border-t border-white/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">ORBITAL PARAMETERS</p>
          <div className="grid grid-cols-[1.4fr_1fr] gap-y-1">
            <span>Orbit Type</span>
            <span className="text-right">
              {selectedSatellite.orbitType} ({ORBIT_LABELS[selectedSatellite.orbitType]})
            </span>
            <span>Current Altitude</span>
            <span className="text-right">{selectedSatellite.altitudeKm.toFixed(1)} km</span>
            <span>Velocity</span>
            <span className="text-right">{selectedSatellite.velocityKms.toFixed(3)} km/s</span>
            <span>Orbital Period</span>
            <span className="text-right">{periodMinutes.toFixed(1)} min</span>
            <span>Inclination</span>
            <span className="text-right">--</span>
          </div>
        </div>

        <div className="space-y-1 border-t border-white/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">CONJUNCTION WARNINGS</p>
          {relatedConjunctions.length === 0 ? (
            <p className="rounded-sm border border-[#3ed08a]/40 bg-[#10392a]/60 px-2 py-1 text-[11px] text-[#79ecb4]">
              NO ACTIVE WARNINGS
            </p>
          ) : (
            <div className="space-y-1">
              {relatedConjunctions.map((conjunction) => (
                <div key={conjunction.id} className="rounded-sm border border-white/10 px-2 py-1">
                  <p className="truncate text-[11px] text-white">{conjunctionPeerName(selectedSatellite, conjunction)}</p>
                  <p className="text-[10px] text-[#9cc2de]">
                    TCA {formatCountdownToTca(conjunction.tca)} | {formatMissDistance(conjunction.missDistanceM)} | Pc {formatProbability(conjunction.probability)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1 border-t border-white/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">SPACE WEATHER IMPACT</p>
          <div className={`inline-block rounded-sm border px-2 py-0.5 text-[10px] ${riskBadgeClass(impact.label)}`}>
            {impact.label}
          </div>
          <p className="text-[11px] text-[#b9d6ee]">
            {selectedSatellite.orbitType === "LEO"
              ? "Atmospheric drag risk:"
              : selectedSatellite.orbitType === "GEO"
                ? "Surface charging risk:"
                : "Radiation impact risk:"}{" "}
            {impact.description}
          </p>
          <p className="text-[10px] text-[#8eb1cb]">Updated {formatUtcTime(now)}</p>
        </div>
      </div>
    </PanelCard>
  );
};

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
              NORAD {selectedConjunction.object1.noradId} | {object1?.orbitType ?? "LEO"}
            </p>
          </div>
          <p className="text-center text-[10px] text-[#7ca2bf]">vs</p>
          <div className="rounded-sm border border-white/10 px-2 py-1">
            <p className="text-white">{selectedConjunction.object2.name}</p>
            <p className="text-[10px] text-[#9cc2de]">
              NORAD {selectedConjunction.object2.noradId} | {object2?.orbitType ?? "LEO"}
            </p>
          </div>
        </div>

        <div className="space-y-1 border-t border-white/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">CLOSE APPROACH DATA</p>
          <div className="grid grid-cols-[1.4fr_1fr] gap-y-1">
            <span>TCA (UTC)</span>
            <span className="text-right text-[11px]">{(selectedConjunction.tca instanceof Date ? selectedConjunction.tca : new Date(selectedConjunction.tca)).toISOString().replace("T", " ").replace(".000Z", " UTC")}</span>
            <span>Time until TCA</span>
            <span className="text-right">{formatCountdownToTca(selectedConjunction.tca)}</span>
            <span>Miss distance</span>
            <span className={`text-right ${missDistanceClass}`}>{formatMissDistance(selectedConjunction.missDistanceM)}</span>
            <span>Relative velocity</span>
            <span className="text-right">{selectedConjunction.relativeVelocityKms.toFixed(2)} km/s</span>
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
            <span>ACTION &gt; 1/1000</span>
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
  const kpPosition = kpToPercent(spaceWeather.kpIndex);
  const auroraLatitude = kpToAuroraBoundaryLatitude(spaceWeather.kpIndex);
  const auroraRadiusDeg = kpToAuroraRadiusDegrees(spaceWeather.kpIndex);

  const forecast = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => {
        const hoursAhead = index * 3;
        const wave = Math.sin(index * 0.9) * 0.8 + Math.cos(index * 0.35) * 0.4;
        const kp = Math.max(0, Math.min(9, Number((spaceWeather.kpIndex + wave).toFixed(1))));
        return { hoursAhead, kp };
      }),
    [spaceWeather.kpIndex]
  );

  return (
    <PanelCard title="Space Weather" closeLabel="Close space weather panel" onClose={() => closePanel("space-weather")}>
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--aurora-accent)]">SPACE WEATHER | NOAA SWPC</p>
          <p className="text-[10px] text-[#9cc2de]">Last updated {spaceWeather.lastUpdated.toISOString().replace("T", " ").replace(".000Z", " UTC")}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
          <div className="rounded-sm border border-white/10 px-2 py-1">
            <p className="text-[10px] text-[#9cc2de]">Kp Index</p>
            <p className="text-lg font-semibold" style={{ color: getKpColor(spaceWeather.kpIndex) }}>
              {spaceWeather.kpIndex.toFixed(1)}
            </p>
            <div className="relative mt-1 h-1.5 rounded bg-gradient-to-r from-[#6dff79] via-[#ffcb3b] to-[#ff2a2a]">
              <div className="absolute -top-1 h-3 w-[2px] bg-white" style={{ left: `calc(${kpPosition}% - 1px)` }} />
            </div>
          </div>
          <div className="rounded-sm border border-white/10 px-2 py-1">
            <p className="text-[10px] text-[#9cc2de]">Solar Wind Speed</p>
            <p className="text-lg">
              {spaceWeather.solarWindSpeed} km/s{" "}
              <span className={spaceWeather.solarWindSpeed >= 450 ? "text-[#ffaf5e]" : "text-[#75e6ad]"}>
                {spaceWeather.solarWindSpeed >= 450 ? "↑" : "↓"}
              </span>
            </p>
          </div>
          <div className="rounded-sm border border-white/10 px-2 py-1">
            <p className="text-[10px] text-[#9cc2de]">Bz Component</p>
            <p
              className={spaceWeather.bzComponent < 0 ? "text-lg text-[#ff6f6f]" : "text-lg text-[#75e6ad]"}
              title="Negative Bz = Earth's magnetic shield weakened"
            >
              {spaceWeather.bzComponent.toFixed(1)} nT
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
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">24H FORECAST (3H STEPS)</p>
          <svg viewBox="0 0 320 86" className="h-[86px] w-full rounded-sm border border-white/10 bg-[#081423]">
            {forecast.map((item, index) => {
              const barWidth = 28;
              const spacing = 10;
              const x = 8 + index * (barWidth + spacing);
              const barHeight = kpToBarHeight(item.kp, 58);
              const y = 70 - barHeight;
              return (
                <g key={item.hoursAhead}>
                  <rect x={x} y={y} width={barWidth} height={barHeight} fill={getKpColor(item.kp)} opacity="0.82" />
                  <text x={x + 14} y={80} fill="#9cc2de" textAnchor="middle" fontSize="8">
                    +{item.hoursAhead}h
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-1 border-t border-white/10 pt-2">
          <p className="text-[10px] tracking-[0.16em] text-[var(--aurora-accent)]">AURORA VISIBILITY</p>
          <p className="text-[11px] text-white">Currently visible above {auroraLatitude.toFixed(1)}N latitude</p>
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
          ) : (
            <div className="mt-1 flex items-center gap-2 text-[11px] text-[#ffcd73]">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#ffcd73] border-t-transparent" />
              <span>Connecting to backend...</span>
            </div>
          )}
        </div>
      </div>
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
          return <SatelliteDetailPanel key={panelKey} />;
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
