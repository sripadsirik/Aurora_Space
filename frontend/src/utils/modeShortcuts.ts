/**
 * Number-key shortcuts for the visual-mode selector.
 *
 * The mode selector lets the operator jump straight to a view by pressing 1-4.
 * That mapping was inlined in the `ModeSelector` key handler as a `parseInt`
 * plus a bounds check against a magic `4`; centralising both the ordering and
 * the lookup here keeps the rendered buttons and the keyboard shortcuts driven
 * by one source of truth.
 */

import type { VisualMode } from "../types/space";

/**
 * The visual modes in the order they are laid out in the selector, which is also
 * the order their `1`-based number-key shortcuts follow (`1` -> `OPS`, `2` ->
 * `STORM`, and so on).
 */
export const MODE_SHORTCUT_ORDER: readonly VisualMode[] = ["OPS", "STORM", "INTEL", "HELIO"];

/**
 * Resolves a keyboard `event.key` to the visual mode it selects, or `null` when
 * the key is not one of the mode shortcuts. Only the single digits `1` through
 * `MODE_SHORTCUT_ORDER.length` map to a mode; anything else (letters, `0`,
 * multi-character keys like `Enter`) returns `null`.
 */
export const modeForShortcutKey = (key: string): VisualMode | null => {
  if (!/^[0-9]$/.test(key)) return null;
  const index = Number.parseInt(key, 10);
  if (index < 1 || index > MODE_SHORTCUT_ORDER.length) return null;
  return MODE_SHORTCUT_ORDER[index - 1];
};
