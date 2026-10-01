import { Assets, Spritesheet, Texture } from 'pixi.js'
import type { ShipSkin } from '../game/types'
import { MAP_TILE_IDS, type TileTextures } from './views/IslandsView'

const base = import.meta.env.BASE_URL

const GAME_BUNDLE = 'game'

const tileAlias = (id: number): string => `tile_${String(id)}`
const tileUrl = (id: number): string =>
  `${base}assets/png/default/tiles/tile_${String(id)}.png`

/**
 * Ship art: ship_N is intact, N+6 damaged, N+12 heavily damaged and N+18
 * the wreck. Distinct hull colours per side: player 1, Chaser 2, Shooter 3.
 */
const SHIP_BASE_INDEX: Readonly<Record<ShipSkin, number>> = {
  player: 1,
  chaser: 2,
  shooter: 3,
}
const DAMAGE_STAGE_OFFSETS = [0, 6, 12, 18] as const
const shipAlias = (skin: ShipSkin, stage: number): string =>
  `ship_${skin}_${String(stage)}`

const shipEntries = (Object.keys(SHIP_BASE_INDEX) as ShipSkin[]).flatMap(
  (skin) =>
    DAMAGE_STAGE_OFFSETS.map((offset, stage): [string, string] => [
      shipAlias(skin, stage),
      `${base}assets/png/default/ships/ship_${String(SHIP_BASE_INDEX[skin] + offset)}.png`,
    ]),
)

/**
 * Individual tile PNGs rather than sub-rectangles of tiles_sheet.png: at
 * fractional letterbox scales, neighbouring tiles in a sheet bleed into
 * each other and show up as seams.
 */
const gameManifest: Record<string, string> = {
  ...Object.fromEntries(shipEntries),
  water: tileUrl(73),
  // TexturePacker JSON-hash atlases; Assets detects the format and resolves
  // each to a Spritesheet (its PNG loads with it). The ships sheet is
  // generated from Starling XML by `npm run atlas`.
  shipsSheet: `${base}assets/spritesheet/ships_miscellaneous_sheet.json`,
  uiSheet: `${base}assets/spritesheet/ui_sheet.json`,
  ...Object.fromEntries(MAP_TILE_IDS.map((id) => [tileAlias(id), tileUrl(id)])),
}

/** Intact, damaged, heavily damaged, wreck. */
export type ShipStages = readonly [Texture, Texture, Texture, Texture]

export interface GameTextures {
  ships: Readonly<Record<ShipSkin, ShipStages>>
  water: Texture
  cannonBall: Texture
  muzzleFlash: Texture
  /** Destruction sequence, played in this order. */
  explosion: readonly [Texture, Texture, Texture]
  fire: readonly [Texture, Texture]
  healthFrame: Texture
  healthFillPlayer: Texture
  healthFillEnemy: Texture
  tile: TileTextures
}

// `instanceof Texture` alone narrows to Texture<any>; the guard keeps it typed.
function isTexture(value: unknown): value is Texture {
  return value instanceof Texture
}

function toGameTextures(loaded: Record<string, unknown>): GameTextures {
  const get = (alias: string): Texture => {
    const texture = loaded[alias]
    if (!isTexture(texture)) {
      throw new Error(`Texture "${alias}" missing from the game bundle`)
    }
    return texture
  }
  const sheet = (alias: string): ((frame: string) => Texture) => {
    const loadedSheet = loaded[alias]
    if (!(loadedSheet instanceof Spritesheet)) {
      throw new Error(`${alias} did not load as a spritesheet`)
    }
    return (frame) => {
      const texture = loadedSheet.textures[frame]
      if (!texture) throw new Error(`Frame "${frame}" missing from ${alias}`)
      return texture
    }
  }
  const shipsFrame = sheet('shipsSheet')
  const uiFrame = sheet('uiSheet')
  const stages = (skin: ShipSkin): ShipStages => [
    get(shipAlias(skin, 0)),
    get(shipAlias(skin, 1)),
    get(shipAlias(skin, 2)),
    get(shipAlias(skin, 3)),
  ]

  return {
    ships: {
      player: stages('player'),
      chaser: stages('chaser'),
      shooter: stages('shooter'),
    },
    water: get('water'),
    cannonBall: shipsFrame('cannon_ball'),
    // The smallest explosion frame reads as a muzzle flash.
    muzzleFlash: shipsFrame('explosion_3'),
    explosion: [
      shipsFrame('explosion_3'),
      shipsFrame('explosion_2'),
      shipsFrame('explosion_1'),
    ],
    fire: [shipsFrame('fire_1'), shipsFrame('fire_2')],
    healthFrame: uiFrame('enemy_health_frame'),
    healthFillPlayer: uiFrame('enemy_health_fill_green'),
    healthFillEnemy: uiFrame('enemy_health_fill_red'),
    tile: (id) => get(tileAlias(id)),
  }
}

let bundleAdded = false
let pending: Promise<GameTextures> | null = null

/**
 * Loads the gameplay textures once and caches them for the lifetime of the
 * page. Textures are shared by every GameSession and never destroyed on
 * restart. On failure the memo is cleared, so a later call retries.
 */
export function loadGameAssets(): Promise<GameTextures> {
  if (!bundleAdded) {
    Assets.addBundle(GAME_BUNDLE, gameManifest)
    bundleAdded = true
  }
  pending ??= (
    Assets.loadBundle(GAME_BUNDLE) as Promise<Record<string, unknown>>
  )
    .then(toGameTextures)
    .catch((error: unknown) => {
      pending = null
      throw error
    })
  return pending
}
