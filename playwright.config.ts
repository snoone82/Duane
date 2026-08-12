import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Aligned's end-to-end suite — see e2e/ and the
 * "Running the tests" section of README.md.
 *
 * This suite is deliberately not mocked: it drives the real dev server
 * against a real Supabase project with supabase/migrations applied and
 * Authentication → Providers → Anonymous switched on (same prerequisites as
 * running the app itself — see README.md "Setup"). The database-verification
 * specs (e2e/database.spec.ts) additionally read NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local to query Supabase directly
 * with the same anon key + RLS posture the app uses — there is no
 * service-role key anywhere in this project, by design.
 */
export default defineConfig({
  testDir: "./e2e",

  // Several specs create real rows in a real Supabase project (audits,
  // audit_responses, auth users) and a couple of tests intentionally reuse
  // browser session state across steps — keep runs serialized rather than
  // parallelized across files to avoid cross-test interference.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      // Runs every spec — most of the suite doesn't care about viewport.
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // A real mobile viewport/device for the mobile-viewport and
      // tap-target-size assertions in e2e/accessibility.spec.ts. Those tests
      // also set their own viewport explicitly, but running them here too
      // covers a real mobile UA/touch profile rather than just a resized
      // desktop browser.
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      testMatch: /.*accessibility\.spec\.ts/,
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
