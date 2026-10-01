import type { Page } from '@playwright/test'
import type { TestStateSnapshot } from '../../src/engine/testHooks'
import { advance, getState, openGame, restart, STEP_MS } from '../helpers/game'
import { expect, test } from '../helpers/test'

/** Everything that must not change once the match is over (effects may fade). */
function frozenPart({ world }: TestStateSnapshot): unknown {
  return {
    tick: world.tick,
    match: world.match,
    spawn: world.spawn,
    rng: world.rng,
    player: world.player,
    enemies: world.enemies,
    projectiles: world.projectiles,
  }
}

/** Tries to do everything at once for `ms`: sail, turn and fire every gun. */
async function tryEverything(page: Page, ms: number): Promise<void> {
  const keys = ['ArrowUp', 'ArrowLeft', 'Space', 'KeyQ', 'KeyE']
  for (const key of keys) await page.keyboard.down(key)
  await advance(page, ms)
  for (const key of keys) await page.keyboard.up(key)
}

test('the match ends when time runs out, and then nothing moves', async ({
  page,
}) => {
  await openGame(page)
  const { durationSeconds } = (await getState(page)).world.config.match

  // One step short of the end: still running.
  await advance(page, durationSeconds * 1000 - STEP_MS)
  const almost = await getState(page)
  expect(almost.world.match.status).toBe('running')

  await advance(page, STEP_MS)
  const ended = await getState(page)
  expect(ended.world.match.status).toBe('ended')
  expect(ended.world.match.endReason).toBe('timeUp')
  expect(ended.world.match.secondsLeft).toBe(0)

  await tryEverything(page, 2000)
  expect(frozenPart(await getState(page))).toEqual(frozenPart(ended))
})

test('the match ends when the player is destroyed, and then nothing moves', async ({
  page,
}) => {
  // Real spawning with a fixed seed: an idle player is rammed and shot
  // until it sinks, long before the timer runs out.
  await openGame(page, { spawn: true, seed: 7 })
  let state = await getState(page)
  for (let i = 0; i < 120 && state.world.match.status === 'running'; i++) {
    await advance(page, 1000)
    state = await getState(page)
  }
  expect(state.world.match.status).toBe('ended')
  expect(state.world.match.endReason).toBe('playerDestroyed')
  expect(state.world.player.hp).toBe(0)
  expect(state.world.match.secondsLeft).toBeGreaterThan(0)

  // Several spawn intervals later: no movement, shots, damage, spawns or score.
  const intervalMs = state.world.config.spawn.intervalSeconds * 1000
  await tryEverything(page, intervalMs * 4)
  expect(frozenPart(await getState(page))).toEqual(frozenPart(state))
})

test('restart starts a fresh match without reloading textures', async ({
  page,
}) => {
  await openGame(page, { spawn: true, seed: 7 })
  await page.keyboard.down('Space')
  await advance(page, 20_000)
  await page.keyboard.up('Space')
  const played = await getState(page)
  expect(played.world.tick).toBeGreaterThan(0)
  expect(played.world.spawn.spawned).toBeGreaterThan(0)

  const imageRequests: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'image' || /\.png$/.test(request.url())) {
      imageRequests.push(request.url())
    }
  })
  await restart(page)

  const fresh = await getState(page)
  const { config } = fresh.world
  expect(fresh.world.tick).toBe(0)
  expect(fresh.world.match).toEqual({
    status: 'running',
    endReason: null,
    secondsLeft: config.match.durationSeconds,
    score: 0,
  })
  expect(fresh.world.player.hp).toBe(config.player.maxHp)
  expect(fresh.world.player.cooldowns).toEqual({ front: 0, left: 0, right: 0 })
  expect(fresh.world.spawn.spawned).toBe(0)
  expect(fresh.world.enemies.filter((e) => e.alive)).toHaveLength(0)
  expect(fresh.world.projectiles.filter((p) => p.alive)).toHaveLength(0)
  expect(imageRequests).toEqual([])

  // And it plays: the first spawn arrives on schedule.
  await advance(page, config.spawn.intervalSeconds * 1000 + STEP_MS)
  expect((await getState(page)).world.spawn.spawned).toBe(1)
})
