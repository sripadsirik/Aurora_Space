import { Color } from "cesium";
import type { RiskLevel } from "../types/space";

/**
 * RGBA colours used to draw conjunction risk arcs and connecting lines on the
 * globe. Alpha rises with severity so more urgent conjunctions read as bolder,
 * more opaque strokes: a translucent orange `watch`, a stronger `warning`, and a
 * fully opaque red `critical`. Centralised here so the globe overlays and any
 * future legend share one source of truth for the risk palette.
 */
export const WATCH_CONJUNCTION_COLOR = Color.fromBytes(255, 100, 0, 153);
export const WARNING_CONJUNCTION_COLOR = Color.fromBytes(255, 50, 0, 204);
export const CRITICAL_CONJUNCTION_COLOR = Color.fromBytes(255, 0, 0, 255);

/**
 * Maps a conjunction {@link RiskLevel} to the Cesium colour used to render it.
 * The calmer `nominal` tier is fully transparent so nominal conjunctions draw no
 * visible arc. A fresh clone is returned on every call so callers can mutate the
 * result (for example adjusting alpha per frame) without disturbing the shared
 * palette constants.
 */
export const getConjunctionColor = (riskLevel: RiskLevel): Color => {
  if (riskLevel === "critical") return CRITICAL_CONJUNCTION_COLOR.clone();
  if (riskLevel === "warning") return WARNING_CONJUNCTION_COLOR.clone();
  if (riskLevel === "watch") return WATCH_CONJUNCTION_COLOR.clone();
  return Color.TRANSPARENT.clone();
};
