import { describe, expect, it } from "vitest";

import { getHudTheme } from "../hudTheme";

describe("getHudTheme", () => {
  it("uses the calm default palette in OPS mode with quiet Kp", () => {
    const theme = getHudTheme("OPS", 2);
    expect(theme.isIntel).toBe(false);
    expect(theme.isStorm).toBe(false);
    expect(theme.textColor).toBe("var(--aurora-text)");
    expect(theme.accentColor).toBe("var(--aurora-accent)");
    expect(theme.subTextColor).toBe("#cde4f6");
  });

  it("warms the palette when a storm is active", () => {
    const theme = getHudTheme("STORM", 2);
    expect(theme.isStorm).toBe(true);
    expect(theme.textColor).toBe("#ffd8b8");
    expect(theme.accentColor).toBe("#ff8844");
    expect(theme.subTextColor).toBe("#ffccaa");
  });

  it("treats high Kp as a storm even outside STORM mode", () => {
    expect(getHudTheme("OPS", 6).isStorm).toBe(true);
  });

  it("lets INTEL mode override the storm palette", () => {
    const theme = getHudTheme("INTEL", 8);
    expect(theme.isIntel).toBe(true);
    expect(theme.isStorm).toBe(true);
    expect(theme.textColor).toBe("#ffffff");
    expect(theme.accentColor).toBe("#ff6600");
    expect(theme.sourceColor).toBe("#999999");
    expect(theme.clockColor).toBe("#009933");
  });

  it("uses the default secondary colours outside INTEL mode", () => {
    const theme = getHudTheme("OPS", 2);
    expect(theme.alertTextColor).toBe("#d8ebff");
    expect(theme.sourceColor).toBe("#9ec3df");
    expect(theme.clockColor).toBe("#b9d6ee");
  });
});
