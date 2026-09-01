/**
 * Moonlight helpers for aurora viewing.
 *
 * Knowing whether the aurora reaches an observer's latitude (see
 * {@link ./auroraVisibility}) and where to look (see
 * {@link ./auroraViewingDirection}) still leaves out a decisive factor: a bright
 * sky washes out faint aurora. The Moon is the dominant natural source of that
 * glare on a clear night, so a full Moon can hide all but the strongest displays
 * while a new Moon leaves the sky dark. This module turns a date into the Moon's
 * phase and illuminated fraction and classifies how much that moonlight is
 * likely to interfere, so the HUD and space-weather panels can answer "will
 * moonlight spoil tonight's aurora?" from a single tested source.
 *
 * The phase model tracks the synodic (new-Moon-to-new-Moon) cycle from a known
 * new-Moon epoch. It ignores the small libration and orbital-eccentricity
 * effects that shift the exact instant of each phase by a few hours, which is
 * well within the precision an observer needs to plan a night out.
 */

/** Julian Date of the Unix epoch (1970-01-01T00:00:00Z), for date conversions. */
export const UNIX_EPOCH_JULIAN_DATE = 2440587.5;

/** Mean length of the synodic month (new Moon to new Moon), in days. */
export const SYNODIC_MONTH_DAYS = 29.530588853;

/**
 * Julian Date of a reference new Moon (2000-01-06T18:14Z), the epoch NOAA and
 * most almanacs anchor the synodic cycle to. Phase ages are measured forward
 * from this instant.
 */
export const REFERENCE_NEW_MOON_JULIAN_DATE = 2451550.1;

/** Converts a `Date` to its Julian Date, the continuous day count astronomy uses. */
const toJulianDate = (date: Date): number =>
  date.getTime() / 86_400_000 + UNIX_EPOCH_JULIAN_DATE;

/**
 * The Moon's age in days since the most recent new Moon, in `[0, SYNODIC_MONTH_DAYS)`.
 * A new Moon reads `0`, a full Moon roughly half a synodic month. Returns `NaN`
 * for an invalid date.
 */
export const moonAgeDays = (date: Date): number => {
  const julian = toJulianDate(date);
  if (!Number.isFinite(julian)) return Number.NaN;
  const age = (julian - REFERENCE_NEW_MOON_JULIAN_DATE) % SYNODIC_MONTH_DAYS;
  return age < 0 ? age + SYNODIC_MONTH_DAYS : age;
};

/**
 * The Moon's position in its synodic cycle as a fraction in `[0, 1)`: `0` is a
 * new Moon, `0.25` the first quarter, `0.5` the full Moon, and `0.75` the last
 * quarter, wrapping back toward `1` as the next new Moon approaches. Returns
 * `NaN` for an invalid date. This is {@link moonAgeDays} expressed as a fraction
 * of the {@link SYNODIC_MONTH_DAYS synodic month}.
 */
export const moonPhaseFraction = (date: Date): number => {
  const age = moonAgeDays(date);
  if (!Number.isFinite(age)) return Number.NaN;
  return age / SYNODIC_MONTH_DAYS;
};
