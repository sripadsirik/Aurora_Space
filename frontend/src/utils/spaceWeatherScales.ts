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
