/**
 * Normalises a collision probability onto a `0-1` gauge scale using a base-10
 * log mapping: `1e-6` maps to 0 (gauge floor) and `1e-3` maps to 1 (gauge
 * ceiling), with values in between interpolated linearly in log space. A
 * non-positive probability returns 0, and the result is clamped to `[0, 1]`.
 */
export const normalizeProbability = (probability: number): number => {
  if (probability <= 0) {
    return 0;
  }

  const normalized = (Math.log10(probability) + 6) / 3;
  return Math.max(0, Math.min(1, normalized));
};
