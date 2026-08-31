import { clamp01 } from "./clamp";

/**
 * Storm-overlay visual styling derived from the effective Kp index.
 *
 * The full-screen STORM overlay (red vignette plus the pulsing status banner)
 * scales its opacity and warmth with a single `0-1` intensity value. The
 * component previously computed that value and every derived CSS string inline
 * in JSX; centralising the maths here gives the intensity ramp and each colour
 * a single tested definition and keeps the overlay markup declarative.
 */

/** Kp index at which the storm intensity ramp starts (intensity `0`). */
export const STORM_INTENSITY_KP_FLOOR = 4;

/** Kp span over which intensity climbs from `0` to `1` above the floor. */
export const STORM_INTENSITY_KP_SPAN = 5;

/**
 * Maps an effective Kp index onto the `0-1` storm intensity used to drive the
 * overlay's opacity and colour warmth. Kp {@link STORM_INTENSITY_KP_FLOOR} maps
 * to `0` and climbs linearly to `1` at Kp {@link STORM_INTENSITY_KP_FLOOR} +
 * {@link STORM_INTENSITY_KP_SPAN} (Kp 9). The result is clamped to `[0, 1]` so a
 * sub-floor Kp during the overlay fade-out never yields a negative intensity.
 */
export const stormIntensity = (kp: number): number =>
  clamp01((kp - STORM_INTENSITY_KP_FLOOR) / STORM_INTENSITY_KP_SPAN);

/**
 * `box-shadow` for the red screen-edge vignette. Both the blur and the spread
 * grow with `intensity`, so a stronger storm reads as a deeper, redder frame.
 * Expects an intensity already normalised by {@link stormIntensity}.
 */
export const stormVignetteShadow = (intensity: number): string => {
  const blur = 80 + intensity * 120;
  const spread = 20 + intensity * 40;
  const green = Math.round(30 + (1 - intensity) * 40);
  const alpha = 0.15 + intensity * 0.2;
  return `inset 0 0 ${blur}px ${spread}px rgba(255,${green},0,${alpha})`;
};

/** Inline CSS properties for the pulsing storm status banner. */
export interface StormBannerStyle {
  borderColor: string;
  backgroundColor: string;
  color: string;
  textShadow: string;
}

/**
 * Colour and glow for the storm status banner, warming with `intensity`: the
 * border and text shift toward pure red and the translucent red backing and
 * text glow deepen. Expects an intensity already normalised by
 * {@link stormIntensity}.
 */
export const stormBannerStyle = (intensity: number): StormBannerStyle => {
  const borderGreen = Math.round(60 + (1 - intensity) * 80);
  const backingAlpha = 0.5 + intensity * 0.3;
  const textGreen = Math.round(120 + (1 - intensity) * 60);
  const textBlue = Math.round(60 + (1 - intensity) * 40);
  const glowAlpha = 0.4 + intensity * 0.3;
  return {
    borderColor: `rgba(255,${borderGreen},0,0.6)`,
    backgroundColor: `rgba(80,10,0,${backingAlpha})`,
    color: `rgb(255,${textGreen},${textBlue})`,
    textShadow: `0 0 10px rgba(255,60,0,${glowAlpha})`
  };
};

/** The full set of storm-overlay styles derived from a single Kp index. */
export interface StormOverlayStyle {
  intensity: number;
  vignetteShadow: string;
  banner: StormBannerStyle;
}

/**
 * Derives every storm-overlay style from an effective Kp index in one pass: the
 * shared {@link stormIntensity}, the {@link stormVignetteShadow}, and the
 * {@link stormBannerStyle}. Consuming the whole set from one call keeps the
 * vignette and banner locked to the same intensity.
 */
export const buildStormOverlayStyle = (kp: number): StormOverlayStyle => {
  const intensity = stormIntensity(kp);
  return {
    intensity,
    vignetteShadow: stormVignetteShadow(intensity),
    banner: stormBannerStyle(intensity)
  };
};
