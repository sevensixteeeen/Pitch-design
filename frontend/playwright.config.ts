// End-to-end tests (replica/test-plan.md): `npm run e2e`. They start their own dev servers, so they never
// touch the Supabase project, even though .env.local has its keys:
// - "fake" (almost every test): the app on fake data (this browser's IndexedDB)
// - "real-mode" (e2e/real-mode/): the app's real data layer, pointed at a made-up Supabase address; each
//   test answers every Supabase and API request itself (e.g. to act out the API server being down)
import { defineConfig, devices } from "@playwright/test";

// away from the ports `npm run dev` picks (5173 and up when busy) and the manual fake-data server (5174)
const FAKE_PORT = 5180;
const REAL_MODE_PORT = 5181;

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e-results",
  fullyParallel: true,
  workers: 2, // light on a laptop; each test gets its own browser storage, so they can't see each other
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "fake", testIgnore: /real-mode[\\/]/, use: { baseURL: `http://localhost:${FAKE_PORT}` } },
    { name: "real-mode", testMatch: /real-mode[\\/].*\.spec\.ts$/, use: { baseURL: `http://localhost:${REAL_MODE_PORT}` } },
  ],
  webServer: [
    {
      command: `npx vite --mode fake --port ${FAKE_PORT} --strictPort`,
      url: `http://localhost:${FAKE_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      // variables set here win over the .env files, so the app falls back to fake data
      env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
    },
    {
      command: `npx vite --port ${REAL_MODE_PORT} --strictPort`,
      url: `http://localhost:${REAL_MODE_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      // a Supabase address that doesn't exist; the tests answer for it (e2e/real-mode/)
      env: { VITE_SUPABASE_URL: "https://e2e-dummy.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-dummy-key" },
    },
  ],
});
