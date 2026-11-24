import { defineConfig, devices } from "@playwright/test"

const CI = !!process.env.CI

export default defineConfig({
  testDir: "./e2e",
  // The app runs on the Vite dev server, which is slow to serve a page while
  // other tests load pages too. Longer flows (several sign-ins and reloads)
  // can outlast the default 30 s without anything being wrong.
  timeout: 60_000,
  forbidOnly: CI,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3050", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Locally the dev servers are already running and get reused. CI has none,
  // so Playwright starts both and waits until they answer.
  webServer: [
    {
      command: "pnpm --filter backend start",
      url: "http://localhost:4050/api/docs",
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
    {
      command: "pnpm dev",
      url: "http://localhost:3050",
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
})
