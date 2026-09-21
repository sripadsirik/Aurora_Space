/**
 * Solar-wind–magnetosphere coupling via the dawn-dusk electric field.
 *
 * The rate at which the solar wind pours energy into the magnetosphere is set
 * mostly by the motional electric field it carries, `E = V * B`, and by how much
 * of the interplanetary field points *southward* to reconnect with Earth's own.
 * A fast wind carrying a strong southward field drives reconnection hard and
 * feeds the ring current; a northward field barely couples at all. These helpers
 * turn the bulk speed and Bz the feeds already report into a dawn-dusk electric
 * field in mV/m and a qualitative coupling band, keeping the derived figures in
 * one place beside the ram-pressure helpers.
 */

import type { SpaceWeather } from "../types/space";

/**
 * Coefficient that converts a bulk speed (km/s) and a field (nT) into a motional
 * electric field in mV/m via `E = k * V * B`. It folds the km/s -> m/s
 * (`1e3`), nT -> T (`1e-9`), and V/m -> mV/m (`1e3`) unit conversions into the
 * single factor `1e3 * 1e-9 * 1e3 = 1e-3`.
 */
export const MERGING_FIELD_COEFFICIENT = 1e-3;
