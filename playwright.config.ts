import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${String(PORT)}`
/** The Vite dev server, for the one check that needs React Strict Mode. */
const DEV_PORT = 5173
const DEV_URL = `http://localhost:${String(DEV_PORT)}`
const isCI = Boolean(process.env.CI)

export default defineConfig({
  // e2e/ (behaviour), visual/ (screenshots), dev/ (dev-server only);
  // helpers/ has no specs.
  testDir: 'tests',
  outputDir: 'reports/test-results',
  fullyParallel: true,
  // Each worker runs its own Chromium with a WebGL context; more than a
  // couple exhausts memory on modest machines. Override with --workers.
  workers: 2,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright', open: 'never' }],
  ],
  // Baselines live next to the visual specs, one per project and OS:
  // fonts and anti-aliasing differ between platforms, so a Windows
  // baseline is not compared against a Linux run.
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/__screenshots__/{arg}-{projectName}-{platform}{ext}',
  expect: {
    // Loading the game's assets through the Service Worker can take a few
    // seconds with two workers and both servers busy; 5 s was too tight.
    timeout: 10_000,
    toHaveScreenshot: {
      // Up to 1% of pixels may differ (GPU/anti-aliasing noise).
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: [
    // Everything is tested against the production bundle (MSW included)...
    {
      command: `npx vite build && npx vite preview --port ${String(PORT)} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    // ...except the Strict Mode check: React only double-mounts in
    // development, so it needs the dev server.
    {
      command: `npx vite --port ${String(DEV_PORT)} --strictPort`,
      url: DEV_URL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: 'dev/**',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Chromium-based, isMobile + hasTouch, landscape viewport.
      name: 'mobile-chromium',
      testIgnore: 'dev/**',
      use: { ...devices['Pixel 7 landscape'] },
    },
    {
      name: 'dev-strict-mode',
      testMatch: 'dev/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: DEV_URL },
    },
  ],
})
