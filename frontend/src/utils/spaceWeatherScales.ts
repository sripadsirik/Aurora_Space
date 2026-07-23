/**
 * NOAA Space Weather Prediction Center geomagnetic storm scale (G-scale).
 *
 * The G-scale runs from G1 (minor) to G5 (extreme), with G0 used here to denote
 * sub-storm "quiet" conditions. Levels are derived from the planetary Kp index.
 * See https://www.swpc.noaa.gov/noaa-scales-explanation.
 */
export type GScaleLevel = "G0" | "G1" | "G2" | "G3" | "G4" | "G5";

/**
 * Maps a planetary Kp index to its NOAA geomagnetic storm level. NOAA aligns Kp
 * 5 with G1 and escalates one G-level per whole Kp step up to Kp 9 (G5); anything
 * below Kp 5 is quiet (G0).
 */
export const kpToGScale = (kp: number): GScaleLevel => {
  if (kp >= 9) return "G5";
  if (kp >= 8) return "G4";
  if (kp >= 7) return "G3";
  if (kp >= 6) return "G2";
  if (kp >= 5) return "G1";
  return "G0";
};

/** CSS hex colour for each G-level, escalating from quiet green to extreme red. */
const gScaleColorMap: Record<GScaleLevel, string> = {
  G0: "#7dff6a",
  G1: "#ffcc00",
  G2: "#ff9900",
  G3: "#ff6600",
  G4: "#ff3300",
  G5: "#ff0000"
};

/**
 * Returns the CSS hex colour for a G-level. Unknown values (for example the
 * literal "None") fall back to the quiet-conditions green.
 */
export const gScaleColor = (level: string): string =>
  gScaleColorMap[level as GScaleLevel] ?? gScaleColorMap.G0;

/** Descriptive metadata for a single NOAA geomagnetic storm level. */
export interface GScaleInfo {
  level: GScaleLevel;
  /** NOAA numeric severity code (0 for quiet, 1-5 for G1-G5). */
  code: number;
  /** Short human label for the level. */
  label: string;
  /** One-line summary of the expected operational impact. */
  impact: string;
}

/**
 * The five active NOAA storm levels (G1-G5) with their severity codes and a
 * concise impact summary each. Ordered from least to most severe.
 */
export const geomagneticStormScale: GScaleInfo[] = [
  { level: "G1", code: 1, label: "Minor", impact: "Minor grid fluctuations, weak HF degradation." },
  { level: "G2", code: 2, label: "Moderate", impact: "Moderate spacecraft charging and auroral expansion." },
  { level: "G3", code: 3, label: "Strong", impact: "Surface charging possible, navigation warnings." },
  { level: "G4", code: 4, label: "Severe", impact: "Widespread HF/radio impacts and control errors." },
  { level: "G5", code: 5, label: "Extreme", impact: "Severe infrastructure impacts, major geomagnetic storm." }
];

const quietConditions: GScaleInfo = {
  level: "G0",
  code: 0,
  label: "Quiet",
  impact: "No significant geomagnetic storm activity."
};

/** Looks up the full metadata for a G-level, defaulting to quiet conditions. */
export const gScaleInfo = (level: string): GScaleInfo =>
  geomagneticStormScale.find((entry) => entry.level === level) ?? quietConditions;
