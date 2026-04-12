import { defineConfig, devices } from "@playwright/test";

const isCI = !!Deno.env.get("CI");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? "github" : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "cd .. && deno task build && DENO_ENV=production deno task start",
    port: 3000,
    timeout: 60_000,
    reuseExistingServer: !isCI,
    env: {
      DENO_ENV: "production",
      DATABASE_URL: Deno.env.get("DATABASE_URL_E2E") ??
        "postgres://zone_blitz:zone_blitz@localhost:5432/zone_blitz_e2e",
    },
  },
});
