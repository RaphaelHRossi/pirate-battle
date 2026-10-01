import type { FrozenGameConfig } from './config'
import { DEFAULT_MAP, type FrozenGameMap } from './map'
import { createPool } from './pool'
import { createRng } from './rng'
import type { Effect, Enemy, Projectile, World } from './types'

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

function deadEffect(): Effect {
  return { alive: false, kind: 'muzzleFlash', x: 0, y: 0, heading: 0, ttl: 0 }
}

function deadEnemy(): Enemy {
  return {
    id: 0,
    alive: false,
    kind: 'chaser',
    x: 0,
    y: 0,
    heading: 0,
    hp: 0,
    maxHp: 0,
    hullRadius: 0,
    hullOffset: 0,
    gunCooldown: 0,
    avoidTurn: 0,
  }
}

/** Facing up the screen. */
const PLAYER_START_HEADING = -Math.PI / 2

export function createWorld(
  config: FrozenGameConfig,
  seed: number,
  map: FrozenGameMap = DEFAULT_MAP,
): World {
  const { player, projectiles, effects, spawn, match } = config
  return {
    config,
    map,
    rng: createRng(seed),
    tick: 0,
    elapsedSeconds: 0,
    nextEntityId: 2,
    match: {
      status: 'running',
      endReason: null,
      secondsLeft: match.durationSeconds,
      score: 0,
    },
    spawn: {
      enabled: true,
      timer: spawn.intervalSeconds,
      spawned: 0,
      shootersSpawned: 0,
    },
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
    // At most `maxAlive` enemies exist at once, so that is the pool size.
    enemies: Array.from({ length: spawn.maxAlive }, deadEnemy),
    projectiles: createPool(projectiles.poolSize, deadProjectile),
    effects: createPool(effects.poolSize, deadEffect),
  }
}
