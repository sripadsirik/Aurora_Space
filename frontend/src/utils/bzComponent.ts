/**
 * Interplanetary magnetic field (IMF) Bz-component semantics.
 *
 * A southward IMF (Bz < 0) lets the solar wind reconnect with Earth's
 * magnetosphere and drive geomagnetic activity; a northward IMF (Bz >= 0)
 * leaves the magnetosphere comparatively closed. These helpers centralise that
 * sign convention so panels and overlays classify the Bz reading the same way.
 */

/**
 * True when the IMF Bz component points southward (Bz < 0), the geoeffective
 * case. Zero and non-finite readings are treated as not southward, matching the
 * northward "closed magnetosphere" branch.
 */
export const isBzSouthward = (bz: number): boolean => bz < 0;

/** Magnetosphere shield status labels driven by the Bz sign. */
export type BzMagnetosphereLabel = "SHIELD WEAKENED" | "SHIELD CLOSED";

/**
 * Maps a Bz reading to the magnetosphere "shield" label the heliocentric
 * overlay shows: a southward field reads as `SHIELD WEAKENED`, a northward
 * field as `SHIELD CLOSED`.
 */
export const bzMagnetosphereLabel = (bz: number): BzMagnetosphereLabel =>
  isBzSouthward(bz) ? "SHIELD WEAKENED" : "SHIELD CLOSED";
