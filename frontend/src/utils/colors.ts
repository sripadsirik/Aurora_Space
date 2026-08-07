import { Color } from "cesium";
import type { RiskLevel } from "../types/space";
import type { ConjunctionFleetSeverity } from "./conjunctionRisk";
import { conjunctionRiskTextClass } from "./conjunctionRisk";

/** Cesium colours used to shade satellites and conjunctions by risk level. */
export const riskColorMap: Record<RiskLevel, Color> = {
  nominal: Color.fromCssColorString("#00ff88"),
  watch: Color.fromCssColorString("#ffcc00"),
  warning: Color.fromCssColorString("#ff6600"),
  critical: Color.fromCssColorString("#ff0000")
};

/**
 * Tailwind text-colour utility class used to shade a conjunction table row by
 * its {@link RiskLevel}: red for `critical`, amber for `warning`, and a calm
 * blue-white for the lower `watch`/`nominal` tiers.
 */
export const conjunctionRowTextClass = (risk: RiskLevel): string =>
  conjunctionRiskTextClass(risk, "text-[#d8ebff]");

/**
 * Maps a planetary Kp index (0-9) to a CSS hex colour, escalating from quiet
 * green through storm orange to severe red as geomagnetic activity increases.
 */
export const getKpColor = (kp: number): string => {
  if (kp < 3) {
    return "#7dff6a";
  }
  if (kp < 5) {
    return "#ffcc00";
  }
  if (kp < 7) {
    return "#ff8b38";
  }
  return "#ff2a2a";
};

/**
 * Maps a {@link ConjunctionFleetSeverity} to the CSS hex colour used by the ops
 * warning badge: severe red for `critical`, amber for `warning`, and quiet
 * yellow for the lower `elevated`/`clear` tiers.
 */
export const conjunctionFleetSeverityColor = (severity: ConjunctionFleetSeverity): string => {
  if (severity === "critical") {
    return "#ff2a2a";
  }
  if (severity === "warning") {
    return "#ff8b38";
  }
  return "#ffcc00";
};

/**
 * Maps solar wind speed in km/s to a Cesium colour: calm below 400, elevated
 * through the 400-600 band, and high-speed above 600.
 */
export const getSolarWindColor = (solarWindSpeed: number): Color => {
  if (solarWindSpeed < 400) {
    return Color.fromCssColorString("#fff6b3");
  }

  if (solarWindSpeed <= 600) {
    return Color.fromCssColorString("#ff8d42");
  }

  return Color.fromCssColorString("#ff2a2a");
};
