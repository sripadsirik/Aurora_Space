/**
 * Presentation helpers for the heliocentric overlay's playback and burst
 * controls. The overlay previously derived the playback label and converted
 * between the burst-intensity fraction and its slider percentage inline in JSX;
 * pulling that maths here gives each conversion a single tested definition.
 */

/**
 * Status label for the playback control. When the simulation is paused
 * (`playbackRate === 0`) it reads `PAUSED @ x{selectedRate}` so the operator can
 * see the speed play will resume at; while running it reads `PLAY x{rate}`.
 */
export const helioPlaybackLabel = (playbackRate: number, selectedRate: number): string =>
  playbackRate === 0 ? `PAUSED @ x${selectedRate}` : `PLAY x${playbackRate}`;

/**
 * Converts a burst-intensity fraction (where `1` is the nominal 100% burst) into
 * the whole-percent value the intensity slider and readout use.
 */
export const burstIntensityToPercent = (intensity: number): number => Math.round(intensity * 100);

/** Converts a slider percentage back into the burst-intensity fraction. */
export const percentToBurstIntensity = (percent: number): number => percent / 100;
