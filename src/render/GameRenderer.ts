import { Container, Sprite, TilingSprite } from 'pixi.js'
import type { World } from '../game/types'
import type { GameTextures } from './assets'

/**
 * The ship sprites are drawn with the bow pointing down (+y, heading π/2),
 * while heading 0 points right. Subtracting a quarter turn lines them up.
 */
export const SHIP_SPRITE_ROTATION_OFFSET = -Math.PI / 2

/** Reads the world and mirrors it into display objects. Never mutates it. */
export class GameRenderer {
  readonly root = new Container()
  private readonly arenaWidth: number
  private readonly arenaHeight: number
  private readonly player: Sprite

  constructor(textures: GameTextures, world: Readonly<World>) {
    const { width, height } = world.config.arena
    this.arenaWidth = width
    this.arenaHeight = height

    const water = new TilingSprite({ texture: textures.water, width, height })
    this.player = new Sprite({ texture: textures.shipPlayer, anchor: 0.5 })
    this.root.addChild(water, this.player)
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
  }
}
