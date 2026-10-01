/**
 * Every balancing value lives here. Systems read them from the frozen
 * snapshot stored on the World; they never hard-code numbers.
 */

export interface GunConfig {
  damage: number
  /** Projectile speed in px/s. */
  speed: number
  ttlSeconds: number
  cooldownSeconds: number
}

export interface BroadsideConfig extends GunConfig {
  /** Balls fired per side. */
  count: number
  /** Distance in px between parallel balls. */
  spacing: number
}

export interface ShipConfig {
  maxHp: number
  /** Forward speed in px/s. */
  speed: number
  turnSpeedDegPerSec: number
  /** Radius of the circle used for collisions and arena bounds, in px. */
  collisionRadius: number
}

export interface GameConfig {
  arena: { width: number; height: number }
  match: { durationSeconds: number }
  spawn: {
    intervalSeconds: number
    /** Probability (0..1) that a spawn is a Chaser; otherwise a Shooter. */
    chaserChance: number
    /** At least one Shooter appears within this many first spawns. */
    guaranteedShooterWithinFirst: number
    maxAlive: number
    minDistanceFromPlayer: number
  }
  player: ShipConfig & { frontGun: GunConfig; broadside: BroadsideConfig }
  chaser: ShipConfig & { contactDamage: number }
  shooter: ShipConfig & {
    /** Starts firing when the player is within this distance. */
    range: number
    /** Stops approaching at this distance. */
    stopDistance: number
    gun: GunConfig
  }
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  arena: { width: 1920, height: 1080 },
  match: { durationSeconds: 120 },
  spawn: {
    intervalSeconds: 3,
    chaserChance: 0.6,
    guaranteedShooterWithinFirst: 2,
    maxAlive: 12,
    minDistanceFromPlayer: 500,
  },
  player: {
    maxHp: 100,
    speed: 180,
    turnSpeedDegPerSec: 150,
    collisionRadius: 30,
    frontGun: { damage: 20, speed: 600, ttlSeconds: 1.0, cooldownSeconds: 0.4 },
    broadside: {
      count: 3,
      spacing: 24,
      damage: 15,
      speed: 520,
      ttlSeconds: 0.8,
      cooldownSeconds: 1.5,
    },
  },
  chaser: {
    maxHp: 40,
    speed: 150,
    turnSpeedDegPerSec: 120,
    collisionRadius: 30,
    contactDamage: 25,
  },
  shooter: {
    maxHp: 60,
    speed: 110,
    turnSpeedDegPerSec: 90,
    collisionRadius: 30,
    range: 450,
    stopDistance: 300,
    // Speed and ttl are not in the spec: 400 px/s for 1.25 s reaches 500 px,
    // a little beyond the 450 px firing range.
    gun: { damage: 10, speed: 400, ttlSeconds: 1.25, cooldownSeconds: 2 },
  },
}

/** Player-adjustable match options and their allowed ranges. */
export const MATCH_OPTION_LIMITS = {
  sessionSeconds: { min: 60, max: 180, step: 10 },
  spawnSeconds: { min: 1, max: 10, step: 0.5 },
} as const

export interface MatchOptions {
  sessionSeconds?: number
  spawnSeconds?: number
}

export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K]
}

export type FrozenGameConfig = DeepReadonly<GameConfig>

function deepFreeze<T extends object>(value: T): DeepReadonly<T> {
  for (const child of Object.values(value) as unknown[]) {
    if (typeof child === 'object' && child !== null) deepFreeze(child)
  }
  return Object.freeze(value)
}

/**
 * Returns an immutable copy of the config for one match, so changing the
 * options mid-match (or a bug in a system) can never alter its rules.
 */
export function snapshotConfig(
  options: MatchOptions = {},
  base: GameConfig = DEFAULT_GAME_CONFIG,
): FrozenGameConfig {
  const config = structuredClone(base)
  if (options.sessionSeconds !== undefined) {
    config.match.durationSeconds = options.sessionSeconds
  }
  if (options.spawnSeconds !== undefined) {
    config.spawn.intervalSeconds = options.spawnSeconds
  }
  return deepFreeze(config)
}
