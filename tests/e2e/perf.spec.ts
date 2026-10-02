import { readFile } from 'node:fs/promises'
import { circleAabbPush, hullCircles } from '../../src/game/collision'
import { advance, getState, openGame, resumeClock } from '../helpers/game'
import { expect, test } from '../helpers/test'

interface Report {
  frames: number
  avgFps: number
  frameTimeMs: { p50: number; p95: number; p99: number; max: number }
  workTimeMs: { p50: number; p95: number; p99: number; max: number }
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
  expect(report.workTimeMs.p50).toBeGreaterThan(0)
  expect(report.workTimeMs.p95).toBeGreaterThanOrEqual(report.workTimeMs.p50)
  expect(report.workTimeMs.max).toBeGreaterThanOrEqual(report.workTimeMs.p99)
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

test('the stress fixture keeps 12 Shooters alive and firing around a player that cannot sink', async ({
  page,
}) => {
  await openGame(page, { fixture: 'stress' })
  const start = await getState(page)
  expect(start.world.player.maxHp).toBe(1_000_000)

  await advance(page, 8_000)
  // Over the last 2 s (one full gun cycle), balls are always in the air.
  for (let i = 0; i < 20; i++) {
    await advance(page, 100)
    const { world } = await getState(page)
    expect(
      world.projectiles.filter((p) => p.alive && p.owner === 'enemy').length,
    ).toBeGreaterThan(0)
  }
  const { world } = await getState(page)
  const alive = world.enemies.filter((e) => e.alive)
  expect(alive).toHaveLength(world.config.spawn.maxAlive)
  expect(alive.every((e) => e.kind === 'shooter')).toBe(true)
  // Being hit all along, nowhere near sinking.
  expect(world.player.hp).toBeLessThan(world.player.maxHp)
  expect(world.player.hp).toBeGreaterThan(world.player.maxHp - 2_000)
  expect(world.match.status).toBe('running')
  // The ring is clear of the islands (and stays so).
  for (const enemy of alive) {
    for (const circle of hullCircles(enemy)) {
      for (const box of world.map.colliders) {
        expect(circleAabbPush(circle, box)).toBeNull()
      }
    }
  }
})
