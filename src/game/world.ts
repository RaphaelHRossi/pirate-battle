import type { FrozenGameConfig } from './config'
import { DEFAULT_MAP, type FrozenGameMap } from './map'
import { createPool } from './pool'
import { createRng } from './rng'
import type { MuzzleFlash, Projectile, World } from './types'

function deadProjectile(): Projectile {
  return {
    id: 0,
    alive: false,
    owner: 'player',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    damage: 0,
    ttl: 0,
  }
}

function deadFlash(): MuzzleFlash {
  return { alive: false, x: 0, y: 0, heading: 0, ttl: 0 }
}

/** Facing up the screen. */
const PLAYER_START_HEADING = -Math.PI / 2

export function createWorld(
  config: FrozenGameConfig,
  seed: number,
  map: FrozenGameMap = DEFAULT_MAP,
): World {
  const { player, projectiles, effects } = config
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
      cooldowns: { front: 0, left: 0, right: 0 },
    },
    projectiles: createPool(projectiles.poolSize, deadProjectile),
    muzzleFlashes: createPool(effects.poolSize, deadFlash),
  }
}
