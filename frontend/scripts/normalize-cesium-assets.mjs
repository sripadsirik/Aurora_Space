import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";

// vite-plugin-cesium includes Vite's base path when copying files into dist.
// A Pages project is already served under that path, so remove the extra folder.
const basePath = (process.env.VITE_PUBLIC_BASE ?? "/").replace(/^\/+|\/+$/g, "");
const target = join("dist", "cesium");
if (basePath) {
  const nested = join("dist", basePath, "cesium");
  if (existsSync(nested)) renameSync(nested, target);
}

for (const asset of ["Cesium.js", join("Widgets", "widgets.css")]) {
  if (!existsSync(join(target, asset))) {
    throw new Error(`Cesium build asset is missing: ${asset}`);
  }
}
