import { Container, Sprite, TilingSprite } from 'pixi.js'
import type { World } from '../game/types'
import type { GameTextures } from './assets'
import { DebugView } from './views/DebugView'
import { EffectsView } from './views/EffectsView'
import { EnemiesView } from './views/EnemiesView'
import { createIslandsView } from './views/IslandsView'
import { ProjectilesView } from './views/ProjectilesView'

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
  private readonly enemies: EnemiesView
  private readonly projectiles: ProjectilesView
  private readonly effects: EffectsView
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
    this.projectiles = new ProjectilesView(textures.cannonBall, world)
    this.enemies = new EnemiesView(
      { chaser: textures.shipChaser, shooter: textures.shipShooter },
      world,
      SHIP_SPRITE_ROTATION_OFFSET,
    )
    this.effects = new EffectsView(
      { muzzleFlash: textures.muzzleFlash, explosion: textures.explosion },
      world,
    )
    this.root.addChild(
      water,
      islands,
      this.enemies.container,
      this.player,
      this.projectiles.container,
      this.effects.container,
    )

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
    // A sunk player is replaced by its explosion.
    this.player.visible = player.hp > 0
    this.enemies.sync(world)
    this.projectiles.sync(world)
    this.effects.sync(world)
    this.debug?.sync(world)
  }

  /**
   * Destroys this renderer's display objects. Textures are shared and stay
   * cached in Assets, so a new match reuses them without reloading.
   */
  destroy(): void {
    this.root.destroy({ children: true })
  }
}
