interface AuroraEnv {
  VITE_CESIUM_ION_TOKEN: string;
  VITE_NASA_API_KEY: string;
  VITE_SPACETRACK_USERNAME: string;
  VITE_SPACETRACK_PASSWORD: string;
  VITE_WS_URL: string;
}

const readEnv = (): AuroraEnv => ({
  VITE_CESIUM_ION_TOKEN: import.meta.env.VITE_CESIUM_ION_TOKEN ?? "",
  VITE_NASA_API_KEY: import.meta.env.VITE_NASA_API_KEY ?? "",
  VITE_SPACETRACK_USERNAME: import.meta.env.VITE_SPACETRACK_USERNAME ?? "",
  VITE_SPACETRACK_PASSWORD: import.meta.env.VITE_SPACETRACK_PASSWORD ?? "",
  VITE_WS_URL: import.meta.env.VITE_WS_URL ?? ""
});

export const env = readEnv();
