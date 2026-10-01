import { Container, Sprite, TilingSprite } from 'pixi.js'
import type { World } from '../game/types'
import type { GameTextures } from './assets'
import { DebugView } from './views/DebugView'
import { createIslandsView } from './views/IslandsView'

/**
 * The ship sprites are drawn with the bow pointing down (+y, heading π/2),
 * while heading 0 points right. Subtracting a quarter turn lines them up.
 */
export const SHIP_SPRITE_ROTATION_OFFSET = -Math.PI / 2

export interface RendererOptions {
  /** Draw colliders and hull circles (`?debug=1`). */
  debug: boolean
}

/** Reads the world and mirrors it into display objects. Never mutates it. */
export class GameRenderer {
  readonly root = new Container()
  private readonly arenaWidth: number
  private readonly arenaHeight: number
  private readonly player: Sprite
  private readonly debug: DebugView | null

  constructor(
    textures: GameTextures,
    world: Readonly<World>,
    options: RendererOptions,
  ) {
    const { width, height } = world.config.arena
    this.arenaWidth = width
    this.arenaHeight = height

    const water = new TilingSprite({ texture: textures.water, width, height })
    // Static: built once from the map, never updated per frame.
    const islands = createIslandsView(world.map, textures.tile)
    this.player = new Sprite({ texture: textures.shipPlayer, anchor: 0.5 })
    this.root.addChild(water, islands, this.player)

    this.debug = options.debug ? new DebugView() : null
    if (this.debug) this.root.addChild(this.debug.graphics)
    this.sync(world)
  }

  /** Letterboxes the fixed-size arena into a screen of the given size. */
  layout(screenWidth: number, screenHeight: number): void {
    const scale = Math.min(
      screenWidth / this.arenaWidth,
      screenHeight / this.arenaHeight,
    )
    this.root.scale.set(scale)
    this.root.position.set(
      (screenWidth - this.arenaWidth * scale) / 2,
      (screenHeight - this.arenaHeight * scale) / 2,
    )
  }

  sync(world: Readonly<World>): void {
    const { player } = world
    this.player.position.set(player.x, player.y)
    this.player.rotation = player.heading + SHIP_SPRITE_ROTATION_OFFSET
    this.debug?.sync(world)
  }
}
