import {
  gScaleColor,
  kpToGScaleInfo,
  protonFluxToSScaleInfo,
  rScaleColor,
  sScaleColor,
  xrayClassToRScaleInfo
} from "./spaceWeatherScales";

/** Which of the three NOAA space-weather scales a summary entry describes. */
export type NoaaScaleKind = "G" | "S" | "R";

/** A single NOAA scale resolved to its current level, for at-a-glance display. */
export interface NoaaScaleStatus {
  /** The scale family: geomagnetic (G), solar radiation (S), or radio blackout (R). */
  kind: NoaaScaleKind;
  /** The current level label, for example `G2`, `S0`, or `R1`. */
  level: string;
  /** NOAA numeric severity code (0 for quiet, 1-5 for the active levels). */
  code: number;
  /** Short human label for the level, such as `Moderate` or `Quiet`. */
  label: string;
  /** CSS hex colour for the level, escalating from quiet green to extreme red. */
  color: string;
}

/** The current NOAA state across all three scales plus the most severe of them. */
export interface NoaaScaleSummary {
  geomagnetic: NoaaScaleStatus;
  solarRadiation: NoaaScaleStatus;
  radioBlackout: NoaaScaleStatus;
  /**
   * The single most severe active scale, chosen by highest {@link NoaaScaleStatus.code}.
   * Ties are broken in G > S > R order, matching the order NOAA lists the scales.
   * When all three are quiet this is the geomagnetic quiet entry (G0).
   */
  peak: NoaaScaleStatus;
}

/** The space-weather inputs needed to resolve the three NOAA scales. */
export interface NoaaScaleInputs {
  /** Planetary Kp index driving the geomagnetic (G) scale. */
  kpIndex: number;
  /** GOES X-ray flux class string (for example `C2.4`) driving the radio blackout (R) scale. */
  xrayFlux: string;
  /** Peak >=10 MeV proton flux in pfu driving the solar radiation (S) scale; missing feeds read as quiet. */
  protonFlux?: number;
}

/**
 * Resolves a space-weather snapshot into the current NOAA G/S/R levels and picks
 * the most severe of the three. The `peak` field lets a compact status readout
 * lead with the single dominant hazard while the individual entries stay
 * available for a fuller breakdown. Ties on severity code favour G, then S, then
 * R — the order NOAA itself lists the scales.
 */
export const summarizeNoaaScales = (weather: NoaaScaleInputs): NoaaScaleSummary => {
  const g = kpToGScaleInfo(weather.kpIndex);
  const s = protonFluxToSScaleInfo(weather.protonFlux ?? 0);
  const r = xrayClassToRScaleInfo(weather.xrayFlux);

  const geomagnetic: NoaaScaleStatus = {
    kind: "G",
    level: g.level,
    code: g.code,
    label: g.label,
    color: gScaleColor(g.level)
  };
  const solarRadiation: NoaaScaleStatus = {
    kind: "S",
    level: s.level,
    code: s.code,
    label: s.label,
    color: sScaleColor(s.level)
  };
  const radioBlackout: NoaaScaleStatus = {
    kind: "R",
    level: r.level,
    code: r.code,
    label: r.label,
    color: rScaleColor(r.level)
  };

  // G > S > R tie-break: scan in that order and only replace on a strictly higher code.
  const peak = [geomagnetic, solarRadiation, radioBlackout].reduce((worst, entry) =>
    entry.code > worst.code ? entry : worst
  );

  return { geomagnetic, solarRadiation, radioBlackout, peak };
};
