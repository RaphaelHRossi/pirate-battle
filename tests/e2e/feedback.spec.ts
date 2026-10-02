import type { TestStateSnapshot } from '../../src/engine/testHooks'
import {
  advance,
  getRenderStats,
  getState,
  openGame,
  STEP_MS,
} from '../helpers/game'
import { expect, test } from '../helpers/test'

const aliveEffects = ({ world }: TestStateSnapshot, kind: string) =>
  world.effects.filter((effect) => effect.alive && effect.kind === kind)

/** Same thresholds as the ship art: >2/3 intact, ≥1/3 damaged, else heavy. */
function expectedStage(hp: number, maxHp: number): number {
  if (hp <= 0) return 3
  const ratio = hp / maxHp
  if (ratio > 2 / 3) return 0
  if (ratio >= 1 / 3) return 1
  return 2
}

test('every shot shows a muzzle flash', async ({ page }) => {
  await openGame(page)
  await page.keyboard.press('Space')
  await advance(page, STEP_MS)
  expect(aliveEffects(await getState(page), 'muzzleFlash')).toHaveLength(1)

  await page.keyboard.press('KeyE')
  await advance(page, STEP_MS)
  const { count } = (await getState(page)).world.config.player.broadside
  expect(aliveEffects(await getState(page), 'muzzleFlash').length).toBe(
    1 + count,
  )
})

test('health bars over every ship follow their hp, and ships deteriorate', async ({
  page,
}) => {
  // A Shooter in range keeps hitting a player who does not fire back.
  await openGame(page, { fixture: 'shooter-ahead' })
  const stages = new Set<number>()
  let burned = false

  for (let i = 0; i < 24; i++) {
    const { world } = await getState(page)
    const { renderer } = await getRenderStats(page)
    if (!renderer) throw new Error('no renderer')
    const ships = [world.player, ...world.enemies.filter((e) => e.alive)]
    // One drawn ship (and one health bar) per live ship.
    expect(renderer.ships.map((s) => s.id).sort()).toEqual(
      ships.map((s) => s.id).sort(),
    )
    for (const ship of ships) {
      const drawn = renderer.ships.find((s) => s.id === ship.id)
      expect(drawn?.visible).toBe(true)
      expect(drawn?.barVisible).toBe(true)
      expect(drawn?.barFillRatio).toBeCloseTo(ship.hp / ship.maxHp, 1)
      expect(drawn?.damageStage).toBe(expectedStage(ship.hp, ship.maxHp))
    }
    const player = renderer.ships.find((s) => s.kind === 'player')
    if (player) {
      stages.add(player.damageStage)
      if (player.burning) burned = true
    }
    if (world.player.hp <= 30) break
    await advance(page, 1000)
  }

  // The player's ship went through intact, damaged and heavily damaged,
  // and burns in the last stage.
  expect([...stages].sort()).toEqual([0, 1, 2])
  expect(burned).toBe(true)
  // A hit also flashes the hull (the renderer tints it for hitFlashSeconds).
  expect((await getState(page)).world.player.lastHitAt).not.toBeNull()
})

test('a sunk enemy explodes and leaves a wreck without a health bar', async ({
  page,
}) => {
  await openGame(page, { fixture: 'shooter-ahead' })
  await page.keyboard.down('Space')
  let state = await getState(page)
  for (let i = 0; i < 40 && state.world.enemies.some((e) => e.alive); i++) {
    await advance(page, 100)
    state = await getState(page)
  }
  await page.keyboard.up('Space')

  expect(state.world.enemies.some((e) => e.alive)).toBe(false)
  expect(aliveEffects(state, 'explosion').length).toBeGreaterThan(0)
  expect(aliveEffects(state, 'wreck')).toHaveLength(1)
  const { renderer } = await getRenderStats(page)
  // Only the player is drawn as a ship; the wreck is an effect, with no bar.
  expect(renderer?.ships.map((s) => s.kind)).toEqual(['player'])
})
