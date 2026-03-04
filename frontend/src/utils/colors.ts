import { Color } from "cesium";
import type { RiskLevel } from "../types/space";

export const riskColorMap: Record<RiskLevel, Color> = {
  nominal: Color.fromCssColorString("#00ff88"),
  watch: Color.fromCssColorString("#ffcc00"),
  warning: Color.fromCssColorString("#ff6600"),
  critical: Color.fromCssColorString("#ff0000")
};

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

export const getSolarWindColor = (solarWindSpeed: number): Color => {
  if (solarWindSpeed < 400) {
    return Color.fromCssColorString("#fff6b3");
  }

  if (solarWindSpeed <= 600) {
    return Color.fromCssColorString("#ff8d42");
  }

  return Color.fromCssColorString("#ff2a2a");
};
