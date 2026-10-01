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

export interface World {
  readonly config: FrozenGameConfig
  readonly map: FrozenGameMap
  rng: Rng
  /** Fixed steps simulated so far. */
  tick: number
  /** Simulated time in seconds (tick × step), never wall-clock time. */
  elapsedSeconds: number
  nextEntityId: number
  player: Ship
}
