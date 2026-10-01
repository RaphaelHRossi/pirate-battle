import type { FrozenGameConfig } from './config'
import { DEFAULT_MAP, type FrozenGameMap } from './map'
import { createRng } from './rng'
import type { World } from './types'

/** Facing up the screen. */
const PLAYER_START_HEADING = -Math.PI / 2

export function createWorld(
  config: FrozenGameConfig,
  seed: number,
  map: FrozenGameMap = DEFAULT_MAP,
): World {
  const { player } = config
  return {
    config,
    map,
    rng: createRng(seed),
    tick: 0,
    elapsedSeconds: 0,
    nextEntityId: 2,
    player: {
      id: 1,
      x: map.playerSpawn.x,
      y: map.playerSpawn.y,
      heading: PLAYER_START_HEADING,
      hp: player.maxHp,
      maxHp: player.maxHp,
      hullRadius: player.hullRadius,
      hullOffset: player.hullOffset,
    },
  }
}
