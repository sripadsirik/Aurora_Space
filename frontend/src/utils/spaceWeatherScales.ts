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

/** Resolves a Kp index straight to its full G-level metadata. */
export const kpToGScaleInfo = (kp: number): GScaleInfo => gScaleInfo(kpToGScale(kp));

/**
 * Base peak flux (W/m^2, GOES 0.1-0.8 nm long band) for each solar X-ray class
 * letter. A magnitude of `1` in a class corresponds to its base flux, so "M5"
 * is 5x the M base and "X10" is 10x the X base.
 */
const xrayClassBase: Record<string, number> = {
  A: 1e-8,
  B: 1e-7,
  C: 1e-6,
  M: 1e-5,
  X: 1e-4
};

const xrayFluxPattern = /^\s*([ABCMX])\s*([0-9]+(?:\.[0-9]+)?)?\s*$/i;

/**
 * Parses a GOES X-ray flux class string (for example "C2.4", "M5", or "X10")
 * into its peak flux in W/m^2. A missing magnitude is treated as `1` (so "X"
 * means "X1"). Returns `null` for strings that are not a valid class.
 */
export const parseXrayFlux = (flux: string): number | null => {
  const match = xrayFluxPattern.exec(flux);
  if (!match) return null;
  const base = xrayClassBase[match[1].toUpperCase()];
  const magnitude = match[2] === undefined ? 1 : Number(match[2]);
  return base * magnitude;
};

/**
 * NOAA radio blackout scale (R-scale), driven by peak solar X-ray flux. Runs
 * from R1 (minor) to R5 (extreme), with R0 for sub-blackout conditions.
 */
export type RScaleLevel = "R0" | "R1" | "R2" | "R3" | "R4" | "R5";

/**
 * Maps a peak X-ray flux in W/m^2 to its NOAA radio blackout level using NOAA's
 * thresholds: R1 at M1, R2 at M5, R3 at X1, R4 at X10, and R5 at X20.
 */
export const xrayFluxToRScale = (fluxWpm2: number): RScaleLevel => {
  if (fluxWpm2 >= 2e-3) return "R5";
  if (fluxWpm2 >= 1e-3) return "R4";
  if (fluxWpm2 >= 1e-4) return "R3";
  if (fluxWpm2 >= 5e-5) return "R2";
  if (fluxWpm2 >= 1e-5) return "R1";
  return "R0";
};
