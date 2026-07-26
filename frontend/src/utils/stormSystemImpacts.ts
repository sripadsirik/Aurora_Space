/** A single infrastructure system's status under current geomagnetic activity. */
export interface SystemImpactRow {
  system: string;
  status: string;
  /** CSS hex colour reflecting the severity of the status. */
  color: string;
}

/**
 * Summarises the impact of a geomagnetic storm on key ground and airborne
 * systems for a given Kp index. Impacts sharpen across four Kp bands: quiet
 * (below 5), minor (5-6), strong (7-8), and extreme (above 8).
 */
export const getStormSystemImpacts = (kp: number): SystemImpactRow[] => {
  if (kp > 8) {
    return [
      { system: "HF Radio", status: "BLACKOUT — R4", color: "#ff2a2a" },
      { system: "GPS Accuracy", status: "DEGRADED ±15m", color: "#ff6600" },
      { system: "Power Grids", status: "ELEVATED RISK — High latitudes", color: "#ffcc00" },
      { system: "Aviation", status: "POLAR ROUTES AFFECTED", color: "#ff6600" }
    ];
  }
  if (kp >= 7) {
    return [
      { system: "HF Radio", status: "BLACKOUT — R3", color: "#ff6600" },
      { system: "GPS Accuracy", status: "DEGRADED ±8m", color: "#ff8b38" },
      { system: "Power Grids", status: "ELEVATED RISK — Northern regions", color: "#ffcc00" },
      { system: "Aviation", status: "POLAR ROUTES AFFECTED", color: "#ff8b38" }
    ];
  }
  if (kp >= 5) {
    return [
      { system: "HF Radio", status: "MINOR DEGRADATION — R1", color: "#ffcc00" },
      { system: "GPS Accuracy", status: "SLIGHT DEGRADATION ±3m", color: "#ffcc00" },
      { system: "Power Grids", status: "NOMINAL", color: "#7dff6a" },
      { system: "Aviation", status: "MONITORING", color: "#ffcc00" }
    ];
  }
  return [
    { system: "HF Radio", status: "NOMINAL", color: "#7dff6a" },
    { system: "GPS Accuracy", status: "NOMINAL", color: "#7dff6a" },
    { system: "Power Grids", status: "NOMINAL", color: "#7dff6a" },
    { system: "Aviation", status: "NOMINAL", color: "#7dff6a" }
  ];
};
