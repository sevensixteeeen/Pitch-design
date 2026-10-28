// End-to-end tests (replica/test-plan.md): `npm run e2e`. They start their own dev server on fake data
// (this browser's IndexedDB), so they never touch the Supabase project, even though .env.local has its keys.
import { defineConfig, devices } from "@playwright/test";

// away from the ports `npm run dev` picks (5173 and up when busy) and the manual fake-data server (5174)
const PORT = 5180;

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
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx vite --mode fake --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    // variables set here win over the .env files, so the app falls back to fake data
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
  },
});
