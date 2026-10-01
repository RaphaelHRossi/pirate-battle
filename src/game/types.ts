import type { FrozenGameConfig } from './config'
import type { FrozenGameMap } from './map'
import type { Rng } from './rng'

/** What the player wants to do this step; written by src/input. */
export interface InputIntents {
  forward: boolean
  turnLeft: boolean
  turnRight: boolean
  fireFront: boolean
  fireLeft: boolean
  fireRight: boolean
}

/**
 * Heading is in radians: 0 points right (+x) and it grows clockwise on
 * screen, because y points down. Forward is (cos heading, sin heading).
 */
export interface Ship {
  id: number
  x: number
  y: number
  heading: number
  hp: number
  maxHp: number
  /** Radius of each of the two hull circles. */
  hullRadius: number
  /** Distance from the ship's centre to each hull circle's centre. */
  hullOffset: number
  /** Simulation time of the last damage taken, for the hit flash. */
  lastHitAt: number | null
}

/** Seconds until each weapon can fire again; 0 means ready. */
export interface WeaponCooldowns {
  front: number
  left: number
  right: number
}

export interface PlayerShip extends Ship {
  cooldowns: WeaponCooldowns
}

export type EnemyKind = 'chaser' | 'shooter'

/** A pooled enemy. Dead slots (`alive: false`) take no part in anything. */
export interface Enemy extends Ship {
  alive: boolean
  kind: EnemyKind
  /** Seconds until a Shooter can fire again (unused by Chasers). */
  gunCooldown: number
  /** Turn direction committed to while avoiding an obstacle; 0 = none. */
  avoidTurn: -1 | 0 | 1
}

export type ProjectileOwner = 'player' | 'enemy'

/** A pooled cannonball. Dead slots (`alive: false`) are reused. */
export interface Projectile {
  /** Unique per shot: a reused slot gets a new id. */
  id: number
  alive: boolean
  owner: ProjectileOwner
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  /** Seconds of flight left. */
  ttl: number
}

export type EffectKind = 'muzzleFlash' | 'explosion' | 'wreck'

/** Which ship art a wreck uses. */
export type ShipSkin = 'player' | EnemyKind

/** A pooled, purely visual effect; lives in game time. */
export interface Effect {
  alive: boolean
  kind: EffectKind
  x: number
  y: number
  heading: number
  ttl: number
  /** Ship art, for wrecks only. */
  skin: ShipSkin | null
}

export type MatchStatus = 'running' | 'ended'
export type EndReason = 'timeUp' | 'playerDestroyed'

export interface MatchState {
  status: MatchStatus
  endReason: EndReason | null
  /** Simulated seconds left; counts down only while the match runs. */
  secondsLeft: number
  /** Enemies destroyed by player projectiles. */
  score: number
}

export interface SpawnState {
  enabled: boolean
  /** Simulated seconds until the next spawn. */
  timer: number
  /** Enemies spawned so far this match. */
  spawned: number
  shootersSpawned: number
}

export interface World {
  readonly config: FrozenGameConfig
  readonly map: FrozenGameMap
  rng: Rng
  /** Fixed steps simulated while the match was running. */
  tick: number
  /** Simulated time in seconds (tick × step), never wall-clock time. */
  elapsedSeconds: number
  nextEntityId: number
  match: MatchState
  spawn: SpawnState
  player: PlayerShip
  enemies: Enemy[]
  projectiles: Projectile[]
  effects: Effect[]
}
