import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesium from "vite-plugin-cesium";

export default defineConfig(() => {
  const base = process.env.VITE_PUBLIC_BASE ?? "/";

  return {
    base,
    plugins: [react(), cesium()],
    define: {
      CESIUM_BASE_URL: JSON.stringify(`${base.replace(/\/$/, "")}/cesium`)
    }
  };
});
