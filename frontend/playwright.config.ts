import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/aerospace.spec.ts",
  timeout: process.env.CI ? 180000 : 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5181",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    video: "off",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5181 --strictPort",
    url: "http://127.0.0.1:5181",
    reuseExistingServer: !process.env.CI,
    env: { VITE_WS_URL: "" },
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/browser-results.json" }],
  ],
});
