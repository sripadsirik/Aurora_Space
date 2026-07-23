interface AuroraEnv {
  VITE_CESIUM_ION_TOKEN: string;
  VITE_NASA_API_KEY: string;
  VITE_SPACETRACK_USERNAME: string;
  VITE_SPACETRACK_PASSWORD: string;
  VITE_WS_URL: string;
}

const readEnv = (): AuroraEnv => {
  const values: AuroraEnv = {
    VITE_CESIUM_ION_TOKEN: import.meta.env.VITE_CESIUM_ION_TOKEN ?? "",
    VITE_NASA_API_KEY: import.meta.env.VITE_NASA_API_KEY ?? "",
    VITE_SPACETRACK_USERNAME: import.meta.env.VITE_SPACETRACK_USERNAME ?? "",
    VITE_SPACETRACK_PASSWORD: import.meta.env.VITE_SPACETRACK_PASSWORD ?? "",
    VITE_WS_URL: import.meta.env.VITE_WS_URL ?? ""
  };

  const required: (keyof AuroraEnv)[] = ["VITE_CESIUM_ION_TOKEN"];
  for (const key of required) {
    if (!values[key]) {
      console.error(`[AURORA] Missing required environment variable: ${key}. Set it in .env`);
    }
  }

  const optional: (keyof AuroraEnv)[] = ["VITE_WS_URL", "VITE_NASA_API_KEY"];
  for (const key of optional) {
    if (!values[key]) {
      console.warn(`[AURORA] Optional environment variable ${key} is not set.`);
    }
  }

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
