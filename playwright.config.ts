import { defineConfig } from "@playwright/test";

const port = Number.parseInt(process.env.CARGO_RISK_PORT ?? "4177", 10);

export default defineConfig({
  testDir: "./tests/browser",
  webServer: { command: `npm run dev -- --port ${port}`, port, reuseExistingServer: false },
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "on-first-retry", screenshot: "only-on-failure" },
});
