import { describe, expect, it } from "vitest";
import { hasValidCesiumIonToken } from "../env";

describe("hasValidCesiumIonToken", () => {
  it("accepts a real-looking token", () => {
    expect(hasValidCesiumIonToken("eyJhbGciOi.something")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(hasValidCesiumIonToken("")).toBe(false);
  });

  it("rejects whitespace-only tokens", () => {
    expect(hasValidCesiumIonToken("   ")).toBe(false);
  });

  it("rejects the placeholder value from .env.example", () => {
    expect(hasValidCesiumIonToken("your_cesium_ion_token_here")).toBe(false);
  });

  it("rejects the placeholder even when surrounded by whitespace", () => {
    expect(hasValidCesiumIonToken("  your_cesium_ion_token_here  ")).toBe(false);
  });

  it("trims surrounding whitespace before validating a real token", () => {
    expect(hasValidCesiumIonToken("  abc123  ")).toBe(true);
  });
});
