import { Assets, type Texture } from 'pixi.js'

const base = import.meta.env.BASE_URL

const GAME_BUNDLE = 'game'

const gameManifest = {
  shipPlayer: `${base}assets/png/default/ships/ship_1.png`,
  water: `${base}assets/png/default/tiles/tile_73.png`,
} as const

export type GameTextures = Record<keyof typeof gameManifest, Texture>

let bundleAdded = false
let pending: Promise<GameTextures> | null = null

/**
 * Loads the gameplay textures once and caches them for the lifetime of the page.
 * Textures are shared by every GameSession and are never destroyed on restart.
 */
export function loadGameAssets(): Promise<GameTextures> {
  if (!bundleAdded) {
    Assets.addBundle(GAME_BUNDLE, gameManifest)
    bundleAdded = true
  }
  pending ??= (Assets.loadBundle(GAME_BUNDLE) as Promise<GameTextures>).catch(
    (error: unknown) => {
      // Allow a later retry instead of caching the failure forever.
      pending = null
      throw error
    },
  )
  return pending
}
