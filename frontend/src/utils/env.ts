interface AuroraEnv {
  VITE_CESIUM_ION_TOKEN: string;
  VITE_WS_URL: string;
}

const readEnv = (): AuroraEnv => {
  const values: AuroraEnv = {
    VITE_CESIUM_ION_TOKEN: import.meta.env.VITE_CESIUM_ION_TOKEN ?? "",
    VITE_WS_URL: import.meta.env.VITE_WS_URL ?? ""
  };

  return values;
};

export const env = readEnv();

const CESIUM_TOKEN_PLACEHOLDER = "your_cesium_ion_token_here";

/**
 * True when the given Cesium Ion token is usable: non-empty after trimming and
 * not the `.env.example` placeholder value.
 */
export const hasValidCesiumIonToken = (token: string): boolean => {
  const normalized = token.trim();
  return normalized.length > 0 && normalized !== CESIUM_TOKEN_PLACEHOLDER;
};
