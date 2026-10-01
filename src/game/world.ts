import type { FrozenGameConfig } from './config'
import { createRng } from './rng'
import type { World } from './types'

/** Facing up the screen. */
const PLAYER_START_HEADING = -Math.PI / 2

export function createWorld(config: FrozenGameConfig, seed: number): World {
  const { arena, player } = config
  return {
    config,
    rng: createRng(seed),
    tick: 0,
    elapsedSeconds: 0,
    nextEntityId: 2,
    player: {
      id: 1,
      x: arena.width / 2,
      y: arena.height / 2,
      heading: PLAYER_START_HEADING,
      hp: player.maxHp,
      maxHp: player.maxHp,
      radius: player.collisionRadius,
    },
  }
}
