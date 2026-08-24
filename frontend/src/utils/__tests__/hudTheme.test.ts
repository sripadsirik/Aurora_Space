import { describe, expect, it } from "vitest";
import { deriveHudTheme, HUD_STORM_KP_THRESHOLD } from "../hudTheme";

describe("deriveHudTheme", () => {
  it("uses the calm default tokens for OPS mode at a quiet Kp", () => {
    const theme = deriveHudTheme("OPS", 2);
    expect(theme).toEqual({
      isIntel: false,
      isStorm: false,
      textColor: "var(--aurora-text)",
      accentColor: "var(--aurora-accent)",
      subTextColor: "#cde4f6",
      alertTextColor: "#d8ebff",
      sourceColor: "#9ec3df",
      clockColor: "#b9d6ee"
    });
  });

  it("applies the monochrome orange accent in INTEL mode", () => {
    const theme = deriveHudTheme("INTEL", 2);
    expect(theme.isIntel).toBe(true);
    expect(theme.accentColor).toBe("#ff6600");
    expect(theme.textColor).toBe("#ffffff");
    expect(theme.subTextColor).toBe("#cccccc");
  });

  it("uses the INTEL secondary colours for alerts, sources and the clock", () => {
    const theme = deriveHudTheme("INTEL", 8);
    expect(theme.alertTextColor).toBe("#cccccc");
    expect(theme.sourceColor).toBe("#999999");
    expect(theme.clockColor).toBe("#009933");
  });

  it("warms the palette in STORM mode", () => {
    const theme = deriveHudTheme("STORM", 2);
    expect(theme.isStorm).toBe(true);
    expect(theme.accentColor).toBe("#ff8844");
    expect(theme.textColor).toBe("#ffd8b8");
    expect(theme.subTextColor).toBe("#ffccaa");
  });

  it("enters storm styling in OPS mode once Kp climbs above the threshold", () => {
    expect(deriveHudTheme("OPS", HUD_STORM_KP_THRESHOLD).isStorm).toBe(false);
    expect(deriveHudTheme("OPS", HUD_STORM_KP_THRESHOLD + 0.1).isStorm).toBe(true);
  });

  it("keeps INTEL styling even when Kp is in storm territory", () => {
    const theme = deriveHudTheme("INTEL", 8);
    expect(theme.isIntel).toBe(true);
    expect(theme.isStorm).toBe(true);
    // INTEL wins the colour choice despite the storm flag being set.
    expect(theme.accentColor).toBe("#ff6600");
  });
});
