import { DEFAULT_GAME_CONFIG } from './config'
import { deepFreeze, type DeepReadonly } from './immutable'
import { distanceSq, type Vec2 } from './math'

/** Islands are laid out on the 64 px grid of the tile art. */
export const TILE_SIZE = 64

/**
 * The visible sand edge sits a few px inside the tile and its corners are
 * rounded, so colliders are pulled in to match what the player sees.
 */
export const ISLAND_COLLIDER_INSET = 8

/** No coast may come closer than this to the player spawn. */
const SPAWN_CLEARANCE = 300

/**
 * `sand`: any size from 2×2 tiles (corner/edge/centre tiles repeat).
 * `grass`: a fixed 4×4 piece of art with a sand ring around a grass centre.
 */
export type IslandKind = 'sand' | 'grass'

export interface Island {
  id: string
  kind: IslandKind
  /** Top-left tile, in tile units. */
  col: number
  row: number
  cols: number
  rows: number
}

export type DecorationKind = 'rock' | 'mossyRock' | 'palm' | 'bush'

/** Purely visual props on the islands; they have no colliders. */
export interface Decoration {
  kind: DecorationKind
  x: number
  y: number
  rotationDeg: number
}

/** Axis-aligned box in world px. */
export interface Aabb {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface GameMap {
  islands: Island[]
  decorations: Decoration[]
  colliders: Aabb[]
  playerSpawn: Vec2
}

export type FrozenGameMap = DeepReadonly<GameMap>

const ISLANDS: Island[] = [
  { id: 'northwest', kind: 'grass', col: 4, row: 2, cols: 4, rows: 4 },
  { id: 'northeast', kind: 'sand', col: 22, row: 2, cols: 5, rows: 3 },
  { id: 'southwest', kind: 'sand', col: 5, row: 11, cols: 3, rows: 4 },
  { id: 'southeast', kind: 'grass', col: 21, row: 10, cols: 4, rows: 4 },
]

const DECORATIONS: Decoration[] = [
  { kind: 'palm', x: 352, y: 232, rotationDeg: 0 },
  { kind: 'bush', x: 424, y: 300, rotationDeg: 35 },
  { kind: 'rock', x: 1472, y: 196, rotationDeg: 0 },
  { kind: 'palm', x: 1640, y: 236, rotationDeg: 20 },
  { kind: 'mossyRock', x: 392, y: 784, rotationDeg: 0 },
  { kind: 'bush', x: 444, y: 892, rotationDeg: 70 },
  { kind: 'palm', x: 1440, y: 736, rotationDeg: -15 },
  { kind: 'mossyRock', x: 1512, y: 812, rotationDeg: 40 },
]

export function islandBounds(island: Island): Aabb {
  return {
    minX: island.col * TILE_SIZE,
    minY: island.row * TILE_SIZE,
    maxX: (island.col + island.cols) * TILE_SIZE,
    maxY: (island.row + island.rows) * TILE_SIZE,
  }
}

function insetBox(box: Aabb, inset: number): Aabb {
  return {
    minX: box.minX + inset,
    minY: box.minY + inset,
    maxX: box.maxX - inset,
    maxY: box.maxY - inset,
  }
}

function overlaps(a: Aabb, b: Aabb): boolean {
  return (
    a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY
  )
}

function closestPoint(box: Aabb, point: Vec2): Vec2 {
  return {
    x: Math.min(box.maxX, Math.max(box.minX, point.x)),
    y: Math.min(box.maxY, Math.max(box.minY, point.y)),
  }
}

/** Catches layout mistakes as soon as the module loads, not mid-match. */
function validate(
  map: GameMap,
  arena: { width: number; height: number },
): void {
  const bounds = map.islands.map(islandBounds)
  map.islands.forEach((island, index) => {
    const box = bounds[index]
    if (!box) return
    if (island.kind === 'grass' && (island.cols !== 4 || island.rows !== 4)) {
      throw new Error(`Island ${island.id}: grass islands must be 4×4 tiles`)
    }
    if (island.cols < 2 || island.rows < 2) {
      throw new Error(`Island ${island.id}: islands need at least 2×2 tiles`)
    }
    if (
      box.minX < 0 ||
      box.minY < 0 ||
      box.maxX > arena.width ||
      box.maxY > arena.height
    ) {
      throw new Error(`Island ${island.id} lies outside the arena`)
    }
    bounds.slice(index + 1).forEach((other, offset) => {
      if (overlaps(box, other)) {
        const otherId = map.islands[index + 1 + offset]?.id ?? '?'
        throw new Error(`Islands ${island.id} and ${otherId} overlap`)
      }
    })
  })
  for (const collider of map.colliders) {
    const nearest = closestPoint(collider, map.playerSpawn)
    if (distanceSq(nearest, map.playerSpawn) < SPAWN_CLEARANCE ** 2) {
      throw new Error('An island is too close to the player spawn')
    }
  }
}

function buildMap(): FrozenGameMap {
  const { arena } = DEFAULT_GAME_CONFIG
  const map: GameMap = {
    islands: ISLANDS,
    decorations: DECORATIONS,
    colliders: ISLANDS.map((island) =>
      insetBox(islandBounds(island), ISLAND_COLLIDER_INSET),
    ),
    playerSpawn: { x: arena.width / 2, y: arena.height / 2 },
  }
  validate(map, arena)
  return deepFreeze(map)
}

/** The arena layout: open water lanes between four islands, clear centre. */
export const DEFAULT_MAP: FrozenGameMap = buildMap()
