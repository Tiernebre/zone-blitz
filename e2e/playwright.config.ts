import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

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
      DATABASE_URL: process.env.DATABASE_URL_E2E ??
        "postgres://zone_blitz:zone_blitz@localhost:5432/zone_blitz_e2e",
      BETTER_AUTH_SECRET: "e2e-test-secret-not-real",
      BETTER_AUTH_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "fake-e2e-client-id",
      GOOGLE_CLIENT_SECRET: "fake-e2e-client-secret",
    },
  },
});
