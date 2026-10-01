import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${String(PORT)}`
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: 'tests/e2e',
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
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  // Test the production bundle (MSW included), not the dev server.
  webServer: {
    command: `npx vite build && npx vite preview --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Chromium-based, isMobile + hasTouch, landscape viewport.
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7 landscape'] },
    },
  ],
})
