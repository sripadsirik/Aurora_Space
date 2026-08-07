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
 * Traffic-light colour for a single Kp sample on a history sparkline: red above
 * Kp 7 (strong-to-extreme storm), amber from Kp 5 up to and including 7 (minor
 * storm territory), and green below Kp 5 (quiet). Kept intentionally coarse so
 * the sparkline reads at a glance rather than tracking the full G-scale palette.
 */
export const kpSparklineColor = (kp: number): string => {
  if (kp > 7) return "#ff2a2a";
  if (kp >= 5) return "#ffcc00";
  return "#7dff6a";
};

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

/**
 * Resolves an X-ray flux class string (for example "M5" or "X1.2") straight to
 * its NOAA radio blackout level. Unparseable strings fall back to R0.
 */
export const xrayClassToRScale = (flux: string): RScaleLevel => {
  const parsed = parseXrayFlux(flux);
  return parsed === null ? "R0" : xrayFluxToRScale(parsed);
};

/** CSS hex colour for each R-level, escalating from quiet green to extreme red. */
const rScaleColorMap: Record<RScaleLevel, string> = {
  R0: "#7dff6a",
  R1: "#ffcc00",
  R2: "#ff9900",
  R3: "#ff6600",
  R4: "#ff3300",
  R5: "#ff0000"
};

/**
 * Returns the CSS hex colour for an R-level. Unknown values (for example the
 * literal "None") fall back to the quiet-conditions green.
 */
export const rScaleColor = (level: string): string =>
  rScaleColorMap[level as RScaleLevel] ?? rScaleColorMap.R0;

/** Descriptive metadata for a single NOAA radio blackout level. */
export interface RScaleInfo {
  level: RScaleLevel;
  /** NOAA numeric severity code (0 for quiet, 1-5 for R1-R5). */
  code: number;
  /** Short human label for the level. */
  label: string;
  /** One-line summary of the expected operational impact. */
  impact: string;
}

/**
 * The five active NOAA radio blackout levels (R1-R5) with their severity codes
 * and a concise impact summary each. Ordered from least to most severe.
 */
export const radioBlackoutScale: RScaleInfo[] = [
  { level: "R1", code: 1, label: "Minor", impact: "Weak HF radio degradation on the sunlit side." },
  { level: "R2", code: 2, label: "Moderate", impact: "Limited HF blackout, low-frequency navigation degraded." },
  { level: "R3", code: 3, label: "Strong", impact: "Wide-area HF blackout for about an hour on the sunlit side." },
  { level: "R4", code: 4, label: "Severe", impact: "HF blackout across most of the sunlit side for one to two hours." },
  { level: "R5", code: 5, label: "Extreme", impact: "Complete HF blackout on the entire sunlit side for hours." }
];

const noBlackout: RScaleInfo = {
  level: "R0",
  code: 0,
  label: "Quiet",
  impact: "No significant radio blackout activity."
};

/** Looks up the full metadata for an R-level, defaulting to quiet conditions. */
export const rScaleInfo = (level: string): RScaleInfo =>
  radioBlackoutScale.find((entry) => entry.level === level) ?? noBlackout;

/** Resolves a peak X-ray flux (W/m^2) straight to its full R-level metadata. */
export const xrayFluxToRScaleInfo = (fluxWpm2: number): RScaleInfo =>
  rScaleInfo(xrayFluxToRScale(fluxWpm2));

/**
 * Resolves an X-ray flux class string (for example "M5" or "X1.2") straight to
 * its full R-level metadata. Unparseable strings fall back to quiet conditions.
 */
export const xrayClassToRScaleInfo = (flux: string): RScaleInfo =>
  rScaleInfo(xrayClassToRScale(flux));

/**
 * NOAA solar radiation storm scale (S-scale), driven by the peak flux of
 * >=10 MeV protons measured by GOES in particle flux units (pfu,
 * particles cm^-2 s^-1 sr^-1). Runs from S1 (minor) to S5 (extreme), with S0
 * for sub-storm conditions. See https://www.swpc.noaa.gov/noaa-scales-explanation.
 */
export type SScaleLevel = "S0" | "S1" | "S2" | "S3" | "S4" | "S5";

/**
 * Maps a peak >=10 MeV proton flux in pfu to its NOAA solar radiation storm
 * level using NOAA's decade thresholds: S1 at 10 pfu, S2 at 100, S3 at 1,000,
 * S4 at 10,000, and S5 at 100,000. Anything below 10 pfu is quiet (S0).
 */
export const protonFluxToSScale = (fluxPfu: number): SScaleLevel => {
  if (fluxPfu >= 1e5) return "S5";
  if (fluxPfu >= 1e4) return "S4";
  if (fluxPfu >= 1e3) return "S3";
  if (fluxPfu >= 1e2) return "S2";
  if (fluxPfu >= 10) return "S1";
  return "S0";
};

/** CSS hex colour for each S-level, escalating from quiet green to extreme red. */
const sScaleColorMap: Record<SScaleLevel, string> = {
  S0: "#7dff6a",
  S1: "#ffcc00",
  S2: "#ff9900",
  S3: "#ff6600",
  S4: "#ff3300",
  S5: "#ff0000"
};

/**
 * Returns the CSS hex colour for an S-level. Unknown values (for example the
 * literal "None") fall back to the quiet-conditions green.
 */
export const sScaleColor = (level: string): string =>
  sScaleColorMap[level as SScaleLevel] ?? sScaleColorMap.S0;

/** Descriptive metadata for a single NOAA solar radiation storm level. */
export interface SScaleInfo {
  level: SScaleLevel;
  /** NOAA numeric severity code (0 for quiet, 1-5 for S1-S5). */
  code: number;
  /** Short human label for the level. */
  label: string;
  /** One-line summary of the expected operational impact. */
  impact: string;
}

/**
 * The five active NOAA solar radiation storm levels (S1-S5) with their severity
 * codes and a concise impact summary each. Ordered from least to most severe.
 */
export const solarRadiationStormScale: SScaleInfo[] = [
  { level: "S1", code: 1, label: "Minor", impact: "Minor impacts on HF radio in the polar regions." },
  { level: "S2", code: 2, label: "Moderate", impact: "Small effects on HF propagation and polar navigation." },
  { level: "S3", code: 3, label: "Strong", impact: "Degraded HF at high latitudes, single-event upsets possible." },
  { level: "S4", code: 4, label: "Severe", impact: "Blackout of HF through the polar regions, elevated radiation risk." },
  { level: "S5", code: 5, label: "Extreme", impact: "Complete polar HF blackout, high radiation hazard to crews and satellites." }
];

const noSolarRadiationStorm: SScaleInfo = {
  level: "S0",
  code: 0,
  label: "Quiet",
  impact: "No significant solar radiation storm activity."
};

/** Looks up the full metadata for an S-level, defaulting to quiet conditions. */
export const sScaleInfo = (level: string): SScaleInfo =>
  solarRadiationStormScale.find((entry) => entry.level === level) ?? noSolarRadiationStorm;

/** Resolves a peak >=10 MeV proton flux (pfu) straight to its full S-level metadata. */
export const protonFluxToSScaleInfo = (fluxPfu: number): SScaleInfo =>
  sScaleInfo(protonFluxToSScale(fluxPfu));
