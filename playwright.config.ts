import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:3103", trace: "retain-on-failure" },
  webServer: ["public", "off", "preview"].map((mode, index) => ({
    command: "node scripts/test-server.mjs " + mode,
    url: "http://127.0.0.1:" + (3103 + index) + "/privacy",
    reuseExistingServer: false,
    timeout: 120000,
  })),
});
