import { advance, getState, openGame, resumeClock } from '../helpers/game'
import { expect, test } from '../helpers/test'

const formatTime = (seconds: number): string =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

test('the HUD shows hp, score and time from the game state', async ({
  page,
}) => {
  await openGame(page, { fixture: 'incoming-shot' })
  const hud = {
    health: page.getByTestId('hud-health'),
    score: page.getByTestId('hud-score'),
    time: page.getByTestId('hud-time'),
  }
  const start = (await getState(page)).world
  await expect(hud.health).toHaveText(
    `${String(start.player.hp)} / ${String(start.player.maxHp)}`,
  )
  await expect(hud.score).toHaveText('0')
  await expect(hud.time).toHaveText(
    formatTime(start.config.match.durationSeconds),
  )

  // The incoming ball hits; 2.5 s pass.
  await advance(page, 2500)
  const { world } = await getState(page)
  expect(world.player.hp).toBeLessThan(start.player.maxHp)
  await expect(hud.health).toHaveText(
    `${String(world.player.hp)} / ${String(world.player.maxHp)}`,
  )
  await expect(hud.time).toHaveText(
    formatTime(Math.ceil(world.match.secondsLeft)),
  )
})

test('the HUD score follows kills', async ({ page }) => {
  await openGame(page, { fixture: 'chaser-ahead' })
  await page.keyboard.down('Space')
  await advance(page, 1000)
  await page.keyboard.up('Space')
  expect((await getState(page)).world.match.score).toBe(1)
  await expect(page.getByTestId('hud-score')).toHaveText('1')
})

test('React re-renders only when a HUD value changes, not per frame', async ({
  page,
}) => {
  await openGame(page)
  const renders = async (): Promise<number> =>
    Number(await page.locator('.game-screen').getAttribute('data-render-count'))
  const before = await renders()
  const startTick = (await getState(page)).world.tick

  await resumeClock(page)
  await page.waitForTimeout(5000)

  const frames = (await getState(page)).world.tick - startTick
  const rendered = (await renders()) - before
  // ~300 simulation steps ran, but only the timer changed: ~5 renders.
  expect(frames).toBeGreaterThan(200)
  expect(rendered).toBeGreaterThanOrEqual(4)
  expect(rendered).toBeLessThanOrEqual(8)
})

test('the live region announces events, not every second', async ({ page }) => {
  await openGame(page)
  const announcer = page.getByTestId('announcer')
  const { durationSeconds } = (await getState(page)).world.config.match

  await advance(page, (durationSeconds - 35) * 1000)
  await expect(announcer).toHaveText('')

  // Crossing 30 s left is announced once...
  await advance(page, 5500)
  await expect(announcer).toHaveText('30 seconds left.')
  // ...and the following seconds are not.
  await advance(page, 5000)
  await expect(announcer).toHaveText('30 seconds left.')

  await advance(page, 15000)
  await expect(announcer).toHaveText('10 seconds left.')
  await advance(page, 10000)
  await expect(announcer).toHaveText('Match over: time is up. Score 0.')
})
