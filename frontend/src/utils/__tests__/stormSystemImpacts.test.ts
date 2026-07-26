import { describe, expect, it } from "vitest";
import { getStormSystemImpacts } from "../stormSystemImpacts";

const statusFor = (kp: number, system: string): string =>
  getStormSystemImpacts(kp).find((row) => row.system === system)?.status ?? "";

describe("getStormSystemImpacts", () => {
  it("always reports the same four systems", () => {
    const systems = getStormSystemImpacts(3).map((row) => row.system);
    expect(systems).toEqual(["HF Radio", "GPS Accuracy", "Power Grids", "Aviation"]);
  });

  it("holds every system nominal in quiet conditions", () => {
    const rows = getStormSystemImpacts(3);
    expect(rows.every((row) => row.status === "NOMINAL")).toBe(true);
  });

  it("raises HF radio blackout severity across the Kp bands", () => {
    expect(statusFor(3, "HF Radio")).toBe("NOMINAL");
    expect(statusFor(5, "HF Radio")).toContain("R1");
    expect(statusFor(7, "HF Radio")).toContain("R3");
    expect(statusFor(9, "HF Radio")).toContain("R4");
  });

  it("treats Kp 8 as the strong band and above 8 as extreme", () => {
    expect(statusFor(8, "HF Radio")).toContain("R3");
    expect(statusFor(8.1, "HF Radio")).toContain("R4");
  });

  it("colours nominal statuses green and blackouts red", () => {
    const quiet = getStormSystemImpacts(3);
    expect(quiet.every((row) => row.color === "#7dff6a")).toBe(true);
    const extreme = getStormSystemImpacts(9);
    expect(extreme.find((row) => row.system === "HF Radio")?.color).toBe("#ff2a2a");
  });
});
