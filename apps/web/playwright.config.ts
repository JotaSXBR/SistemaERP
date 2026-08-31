import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const isContinuousIntegration = Boolean(process.env.CI);
const apiDirectory = fileURLToPath(new URL("../api", import.meta.url));

export default defineConfig({
  ...(isContinuousIntegration ? { workers: 1 } : {}),
  forbidOnly: isContinuousIntegration,
  fullyParallel: true,
  outputDir: "test-results",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: isContinuousIntegration
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  retries: isContinuousIntegration ? 2 : 0,
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "./node_modules/.bin/tsx watch src/main.ts",
      cwd: apiDirectory,
      name: "api",
      reuseExistingServer: !isContinuousIntegration,
      timeout: 120_000,
      url: "http://127.0.0.1:3000/api/v1/health",
    },
    {
      command: "./node_modules/.bin/vite --host 0.0.0.0",
      cwd: import.meta.dirname,
      name: "web",
      reuseExistingServer: !isContinuousIntegration,
      timeout: 120_000,
      url: "http://127.0.0.1:5173/diagnostics",
    },
  ],
});
