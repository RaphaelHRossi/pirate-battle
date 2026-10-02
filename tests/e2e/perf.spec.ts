import { readFile } from 'node:fs/promises'
import { advance, getState, resumeClock } from '../helpers/game'
import { expect, test } from '../helpers/test'

interface Report {
  frames: number
  avgFps: number
  frameTimeMs: { p50: number; p95: number; p99: number; max: number }
  entities: { max: number }
  config: { sessionSeconds: number; spawnSeconds: number }
}

test('?perf=1 records real frames and offers the report on the result screen', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Downloads are checked on desktop')
  await page.goto('/?perf=1&test=1&clock=manual&spawn=off&seed=1#/play')
  await expect(page.locator('.game-host')).toHaveAttribute(
    'data-status',
    'ready',
  )
  await expect(page.getByTestId('perf-overlay')).toBeVisible()

  // Some real frames, then play the rest out in game time.
  await resumeClock(page)
  await expect(page.getByTestId('perf-overlay')).toContainText('FPS')
  // Headless Chromium renders slowly (software GL): give it real time.
  await page.waitForTimeout(1500)
  const { config } = (await getState(page)).world
  await advance(
    page,
    (config.match.durationSeconds + config.match.resultDelaySeconds) * 1000,
  )
  await expect(page).toHaveURL(/#\/result$/)

  const downloading = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Download performance report' })
    .click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^perf-120s-3s-.*\.json$/)
  const path = await download.path()
  const report = JSON.parse(await readFile(path, 'utf8')) as Report

  expect(report.frames).toBeGreaterThan(0)
  expect(report.avgFps).toBeGreaterThan(0)
  expect(report.frameTimeMs.p95).toBeGreaterThanOrEqual(report.frameTimeMs.p50)
  expect(report.frameTimeMs.max).toBeGreaterThanOrEqual(report.frameTimeMs.p99)
  expect(report.entities.max).toBeGreaterThanOrEqual(1)
  expect(report.config).toMatchObject({ sessionSeconds: 120, spawnSeconds: 3 })
})

test('without ?perf=1 there is no overlay and no report', async ({ page }) => {
  await page.goto('/?test=1&clock=manual&spawn=off#/play')
  await expect(page.locator('.game-host')).toHaveAttribute(
    'data-status',
    'ready',
  )
  await expect(page.getByTestId('perf-overlay')).toHaveCount(0)
})
