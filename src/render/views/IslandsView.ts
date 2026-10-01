import { Container, Sprite, type Texture } from 'pixi.js'
import { degToRad } from '../../game/math'
import {
  TILE_SIZE,
  type DecorationKind,
  type FrozenGameMap,
  type Island,
} from '../../game/map'

/**
 * Tile numbers refer to public/assets/png/default/tiles/tile_N.png, which
 * are numbered row by row from tilesheet/tiles_sheet.png (16 per row).
 */
const SAND_TILES = [
  [1, 2, 3],
  [17, 18, 19],
  [33, 34, 35],
] as const

const GRASS_TILES = [
  [6, 7, 8, 9],
  [22, 23, 24, 25],
  [38, 39, 40, 41],
  [54, 55, 56, 57],
] as const

const DECORATION_TILES: Readonly<Record<DecorationKind, number>> = {
  rock: 50,
  mossyRock: 66,
  palm: 71,
  bush: 70,
}

/** Every tile the map can use, so the asset bundle can preload them. */
export const MAP_TILE_IDS: readonly number[] = [
  ...new Set([
    ...SAND_TILES.flat(),
    ...GRASS_TILES.flat(),
    ...Object.values(DECORATION_TILES),
  ]),
]

export type TileTextures = (id: number) => Texture

/** Nine-slice pick: first, last or a repeated middle tile on each axis. */
function sliceIndex(position: number, length: number): 0 | 1 | 2 {
  if (position === 0) return 0
  if (position === length - 1) return 2
  return 1
}

function islandTile(island: Island, col: number, row: number): number {
  if (island.kind === 'grass') {
    const id = GRASS_TILES[row]?.[col]
    if (id === undefined) {
      throw new Error(
        `Island ${island.id}: no grass tile at ${String(col)},${String(row)}`,
      )
    }
    return id
  }
  return SAND_TILES[sliceIndex(row, island.rows)][sliceIndex(col, island.cols)]
}

/**
 * Builds the islands and their decorations once. The container is static:
 * nothing in it changes per frame, and it survives until the app is
 * destroyed with the rest of the stage.
 */
export function createIslandsView(
  map: FrozenGameMap,
  tile: TileTextures,
): Container {
  const view = new Container({ label: 'islands' })

  for (const island of map.islands) {
    for (let row = 0; row < island.rows; row++) {
      for (let col = 0; col < island.cols; col++) {
        view.addChild(
          new Sprite({
            texture: tile(islandTile(island, col, row)),
            x: (island.col + col) * TILE_SIZE,
            y: (island.row + row) * TILE_SIZE,
          }),
        )
      }
    }
  }

  for (const decoration of map.decorations) {
    view.addChild(
      new Sprite({
        texture: tile(DECORATION_TILES[decoration.kind]),
        anchor: 0.5,
        x: decoration.x,
        y: decoration.y,
        rotation: degToRad(decoration.rotationDeg),
      }),
    )
  }

  return view
}
