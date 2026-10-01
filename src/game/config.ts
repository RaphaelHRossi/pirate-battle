import { deepFreeze, type DeepReadonly } from './immutable'

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
  /**
   * The hull is modelled as two circles of this radius, centred
   * `hullOffset` px ahead of and behind the ship's position.
   */
  hullRadius: number
  hullOffset: number
}

export interface GameConfig {
  arena: { width: number; height: number }
  match: {
    durationSeconds: number
    /**
     * Simulated seconds the ended match stays on screen (the final
     * explosion plays out) before the result screen opens.
     */
    resultDelaySeconds: number
  }
  spawn: {
    intervalSeconds: number
    /** Probability (0..1) that a spawn is a Chaser; otherwise a Shooter. */
    chaserChance: number
    /** At least one Shooter appears within this many first spawns. */
    guaranteedShooterWithinFirst: number
    maxAlive: number
    minDistanceFromPlayer: number
    /** Spawn points sit this far inside the arena edge, so hulls fit. */
    edgeMargin: number
    /** Random candidate points tried per spawn before giving up this step. */
    attempts: number
  }
  /** Enemy steering. */
  ai: {
    /** How far ahead the obstacle feelers reach, in px. */
    feelerLength: number
    /** Angle of the side feelers from the heading. */
    feelerAngleDeg: number
  }
  projectiles: {
    /** Pre-allocated projectile slots per match. */
    poolSize: number
    /** Collision radius of a cannonball, in px. */
    radius: number
  }
  effects: {
    /** Pre-allocated effect slots (muzzle flashes, explosions) per match. */
    poolSize: number
    muzzleFlashSeconds: number
    explosionSeconds: number
    /** How long a sunk enemy's wreck stays before it has faded out. */
    wreckSeconds: number
    /** How long a ship flashes after taking damage. */
    hitFlashSeconds: number
  }
  player: ShipConfig & { frontGun: GunConfig; broadside: BroadsideConfig }
  chaser: ShipConfig & { contactDamage: number }
  shooter: ShipConfig & {
    /** Starts firing when the player is within this distance. */
    range: number
    /** Stops approaching at this distance. */
    stopDistance: number
    /** Fires only when the player is within this angle of its heading. */
    aimToleranceDeg: number
    gun: GunConfig
  }
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  arena: { width: 1920, height: 1080 },
  // resultDelaySeconds is not in the spec: long enough to see the ship sink.
  match: { durationSeconds: 120, resultDelaySeconds: 2.5 },
  spawn: {
    intervalSeconds: 3,
    chaserChance: 0.6,
    guaranteedShooterWithinFirst: 2,
    maxAlive: 12,
    minDistanceFromPlayer: 500,
    // Not in the spec: a hull is 96 px long, so 70 px keeps it inside.
    edgeMargin: 70,
    attempts: 16,
  },
  // Not in the spec: tuned so ships turn away from a coast in time.
  ai: { feelerLength: 140, feelerAngleDeg: 30 },
  // Not in the spec: worst case is ~25 balls alive at once (player plus 12
  // shooters), so 96 slots never run out. 5 px matches the 10 px sprite.
  projectiles: { poolSize: 96, radius: 5 },
  effects: {
    poolSize: 48,
    muzzleFlashSeconds: 0.12,
    explosionSeconds: 0.6,
    wreckSeconds: 1.5,
    hitFlashSeconds: 0.15,
  },
  player: {
    maxHp: 100,
    speed: 180,
    turnSpeedDegPerSec: 150,
    hullRadius: 24,
    hullOffset: 24,
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
    hullRadius: 24,
    hullOffset: 24,
    contactDamage: 25,
  },
  shooter: {
    maxHp: 60,
    speed: 110,
    turnSpeedDegPerSec: 90,
    hullRadius: 24,
    hullOffset: 24,
    range: 450,
    stopDistance: 300,
    // Not in the spec: about a hull's width at firing range.
    aimToleranceDeg: 8,
    // Speed and ttl are not in the spec: 400 px/s for 1.25 s reaches 500 px,
    // a little beyond the 450 px firing range.
    gun: { damage: 10, speed: 400, ttlSeconds: 1.25, cooldownSeconds: 2 },
  },
}

/**
 * The two options the player can change on the Options screen, and their
 * documented limits. A value is valid only if it lies within [min, max]
 * and is a whole number of `step`s from `min`:
 *
 * - Game session time: 60–180 s in steps of 10 s (default 120 s).
 * - Enemy spawn time: 1–10 s in steps of 0.5 s (default 3 s). Always
 *   positive: at 1 s the 12-ship cap is reached in 12 s; above 10 s a
 *   60 s match would see almost no enemies.
 *
 * The storage module validates saved values against these same limits,
 * so a hand-edited localStorage can never feed the game an invalid match.
 */
export const MATCH_OPTION_LIMITS = {
  sessionSeconds: { min: 60, max: 180, step: 10 },
  spawnSeconds: { min: 1, max: 10, step: 0.5 },
} as const

export type MatchOptionName = keyof typeof MATCH_OPTION_LIMITS

export interface MatchOptions {
  sessionSeconds: number
  spawnSeconds: number
}

export const DEFAULT_MATCH_OPTIONS: Readonly<MatchOptions> = Object.freeze({
  sessionSeconds: DEFAULT_GAME_CONFIG.match.durationSeconds,
  spawnSeconds: DEFAULT_GAME_CONFIG.spawn.intervalSeconds,
})

/** True if `value` is within the option's limits and on its step grid. */
export function isValidOption(name: MatchOptionName, value: number): boolean {
  const { min, max, step } = MATCH_OPTION_LIMITS[name]
  if (!Number.isFinite(value) || value < min || value > max) return false
  const steps = (value - min) / step
  // Tolerate float noise such as 1.5 / 0.5 computed from user input.
  return Math.abs(steps - Math.round(steps)) < 1e-9
}

/** Nearest valid value: clamped to the limits and snapped to the step. */
export function clampOption(name: MatchOptionName, value: number): number {
  const { min, max, step } = MATCH_OPTION_LIMITS[name]
  const snapped = min + Math.round((value - min) / step) * step
  return Math.min(max, Math.max(min, snapped))
}

export type FrozenGameConfig = DeepReadonly<GameConfig>

/**
 * Returns an immutable copy of the config for one match, so changing the
 * options mid-match (or a bug in a system) can never alter its rules.
 */
export function snapshotConfig(
  options: Partial<MatchOptions> = {},
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
