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

/** A pooled, purely visual flash at a gun's muzzle; lives in game time. */
export interface MuzzleFlash {
  alive: boolean
  x: number
  y: number
  /** Direction the shot left in. */
  heading: number
  ttl: number
}

export interface World {
  readonly config: FrozenGameConfig
  readonly map: FrozenGameMap
  rng: Rng
  /** Fixed steps simulated so far. */
  tick: number
  /** Simulated time in seconds (tick × step), never wall-clock time. */
  elapsedSeconds: number
  nextEntityId: number
  player: PlayerShip
  projectiles: Projectile[]
  muzzleFlashes: MuzzleFlash[]
}
