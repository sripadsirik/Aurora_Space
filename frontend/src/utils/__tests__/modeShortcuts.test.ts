import { describe, expect, it } from "vitest";

import { MODE_SHORTCUT_ORDER, modeForShortcutKey } from "../modeShortcuts";

describe("modeForShortcutKey", () => {
  it("maps each in-range digit to its mode in order", () => {
    expect(modeForShortcutKey("1")).toBe("OPS");
    expect(modeForShortcutKey("2")).toBe("STORM");
    expect(modeForShortcutKey("3")).toBe("INTEL");
    expect(modeForShortcutKey("4")).toBe("HELIO");
  });

  it("agrees with MODE_SHORTCUT_ORDER for every entry", () => {
    MODE_SHORTCUT_ORDER.forEach((mode, i) => {
      expect(modeForShortcutKey(String(i + 1))).toBe(mode);
    });
  });

  it("returns null for digits outside the shortcut range", () => {
    expect(modeForShortcutKey("0")).toBeNull();
    expect(modeForShortcutKey("5")).toBeNull();
    expect(modeForShortcutKey("9")).toBeNull();
  });

  it("returns null for non-digit and multi-character keys", () => {
    expect(modeForShortcutKey("a")).toBeNull();
    expect(modeForShortcutKey("Enter")).toBeNull();
    expect(modeForShortcutKey("")).toBeNull();
    expect(modeForShortcutKey(" ")).toBeNull();
  });
});
