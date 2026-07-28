import { defineConfig } from "@playwright/test";

const port = Number.parseInt(process.env.CARGO_RISK_PORT ?? "4173", 10);

export default defineConfig({
  testDir: "./tests/browser",
  webServer: { command: `npm run dev -- --port ${port}`, port, reuseExistingServer: true },
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "on-first-retry", screenshot: "only-on-failure" },
});
