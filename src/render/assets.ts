import { Assets, type Texture } from 'pixi.js'
import { MAP_TILE_IDS, type TileTextures } from './views/IslandsView'

const base = import.meta.env.BASE_URL

const GAME_BUNDLE = 'game'

const tileAlias = (id: number): string => `tile_${String(id)}`
const tileUrl = (id: number): string =>
  `${base}assets/png/default/tiles/tile_${String(id)}.png`

/**
 * Individual tile PNGs rather than sub-rectangles of tiles_sheet.png: at
 * fractional letterbox scales, neighbouring tiles in a sheet bleed into
 * each other and show up as seams.
 */
const gameManifest: Record<string, string> = {
  shipPlayer: `${base}assets/png/default/ships/ship_1.png`,
  water: tileUrl(73),
  ...Object.fromEntries(MAP_TILE_IDS.map((id) => [tileAlias(id), tileUrl(id)])),
}

export interface GameTextures {
  shipPlayer: Texture
  water: Texture
  tile: TileTextures
}

let bundleAdded = false
let pending: Promise<GameTextures> | null = null

function toGameTextures(
  loaded: Record<string, Texture | undefined>,
): GameTextures {
  const get = (alias: string): Texture => {
    const texture = loaded[alias]
    if (!texture) {
      throw new Error(`Texture "${alias}" missing from the game bundle`)
    }
    return texture
  }
  return {
    shipPlayer: get('shipPlayer'),
    water: get('water'),
    tile: (id) => get(tileAlias(id)),
  }
}

/**
 * Loads the gameplay textures once and caches them for the lifetime of the page.
 * Textures are shared by every GameSession and are never destroyed on restart.
 */
export function loadGameAssets(): Promise<GameTextures> {
  if (!bundleAdded) {
    Assets.addBundle(GAME_BUNDLE, gameManifest)
    bundleAdded = true
  }
  pending ??= (
    Assets.loadBundle(GAME_BUNDLE) as Promise<
      Record<string, Texture | undefined>
    >
  )
    .then(toGameTextures)
    .catch((error: unknown) => {
      // Allow a later retry instead of caching the failure forever.
      pending = null
      throw error
    })
  return pending
}
